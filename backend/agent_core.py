"""
agent_core.py
--------------
Handles calling an LLM agent and executing whatever Python analysis code the
agent writes, in a controlled namespace.

HYBRID ARCHITECTURE NOTE: this backend's LIVE inference path is Featherless AI.
Featherless is the primary/required provider for the running demo (Track 3's
AMD-compute requirement is satisfied separately by the offline notebook in
amd_compute/, not by this file — see amd_compute/README.md). Fireworks is kept
only as an optional secondary fallback in case Featherless is briefly
unreachable during a live demo; it is not part of the intended architecture.

Priority order: FEATHERLESS_API_KEY -> FIREWORKS_API_KEY (fallback only) -> offline.

Status is checked by actually testing connectivity once per process (cached),
never by just seeing if a key/URL string is configured - so the reported
status is always true, never a false "LIVE" label.

SECURITY: never hardcode real API keys in this file. Put them in a `.env` file
in this folder (already gitignored - see backend/.env, listed in .gitignore)
so python-dotenv loads them automatically without ever exposing them in the
public GitHub repo. Only .env.example (with blank values) should be committed.
"""

import os
import random
import time
import traceback

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed - env vars can still be set manually

FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY", "")
FIREWORKS_MODEL = os.environ.get("FIREWORKS_MODEL", "accounts/fireworks/models/llama-v3p1-70b-instruct")
FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions"

# Featherless AI - the primary, required LLM provider for the live backend.
# Pulled from the FEATHERLESS_API_KEY environment variable (set it in
# backend/.env, which is gitignored - see backend/.env.example for the
# expected keys).
FEATHERLESS_API_KEY = os.environ.get("FEATHERLESS_API_KEY", "")
FEATHERLESS_MODEL = os.environ.get("FEATHERLESS_MODEL", "Qwen/Qwen2.5-7B-Instruct")
FEATHERLESS_URL = "https://api.featherless.ai/v1/chat/completions"

# Featherless-on-AMD relay: when set, the actual outbound Featherless call is
# dispatched from amd_compute/featherless_notebook_server.ipynb running on the
# AMD Developer Cloud instance, instead of straight from this backend process.
# Start that notebook's last cell first, then point this at it (see
# backend/.env.example). If unset/unreachable, call_featherless() transparently
# falls back to calling Featherless directly so the backend still works when
# the notebook isn't running (e.g. local dev, or the notebook kernel died).
NOTEBOOK_FEATHERLESS_URL = os.environ.get("NOTEBOOK_FEATHERLESS_URL", "")

# Cache connectivity checks so we don't ping the provider on every single
# specialist call. Success is cached for a long time (a working provider
# rarely needs re-verifying). A FAILURE is cached only briefly - a transient
# blip (cold connection, momentary rate limit) on the very first ping must
# not lock the whole server process into "offline" for its entire lifetime.
# Previously a negative result was cached forever (checked=True stuck True),
# which is exactly what caused custom-patient analyses to permanently show
# "LLM OFFLINE" even though the provider was reachable seconds later.
_STATUS_CACHE = {"checked_at": 0.0, "provider": None}
_SUCCESS_TTL_SECONDS = 300   # re-verify a healthy provider every 5 minutes
_FAILURE_TTL_SECONDS = 15    # retry quickly after a failure instead of forever

# Counts actual call_llm() invocations (including retries), so the Benchmark tab
# can show a real number. Reset at the start of each /api/analyze request.
_LLM_CALL_COUNTER = {"count": 0}


def reset_llm_call_counter() -> None:
    _LLM_CALL_COUNTER["count"] = 0


def get_llm_call_count() -> int:
    return _LLM_CALL_COUNTER["count"]


# Sampling temperature for the risk-scoring calls. This is a model-sampling
# knob, not a clinical value - it doesn't hardcode any score/cutoff, it just
# controls how deterministic vs. random the model is when generating its
# scoring code. Left at the provider default (unset) this was landing close
# to 1.0 on both providers, which is tuned for creative writing variety, not
# for a task where the SAME patient labs should reason to close to the SAME
# score every run. Low-but-not-zero keeps the model from being fully greedy
# (still lets it explore reasonable cutoff choices) while cutting a lot of
# run-to-run noise in the computed risk_score/flag.
SCORING_TEMPERATURE = 0.2


def _post_with_retry(url: str, headers: dict, json_body: dict, timeout: int = 30) -> "requests.Response":
    """POST with short backoff-and-retry, but ONLY for transient/provider-side
    conditions (HTTP 429 rate limiting, or a connection/timeout error) - never
    for a real 4xx/5xx from the provider actually rejecting the request body.

    Why this exists: all 4 specialists fire their LLM calls in parallel (see
    run_pipeline.py's fan-out), so on Featherless's free/test tier it's common
    for exactly one of the 4 simultaneous requests to get hit with a 429 while
    the other 3 succeed - which looks like a totally random single specialist
    going "Unavailable" on any given run, even though nothing about that
    specialist or its prompt was actually wrong. Before this fix, a 429 was
    treated identically to the model writing broken Python: it just burned one
    of specialists.py's 2 code-quality retry attempts and moved on. Retrying
    the plain network call here (with a short backoff so we don't hammer
    straight back into the same rate limit) fixes the actual transient cause
    instead of spending a code-quality retry on a problem that had nothing to
    do with code quality.
    """
    import requests
    last_exc: Exception | None = None
    for attempt in range(4):
        try:
            resp = requests.post(url, headers=headers, json=json_body, timeout=timeout)
        except requests.exceptions.RequestException as e:
            last_exc = e
            time.sleep(0.6 * (attempt + 1))
            continue
        if resp.status_code == 429:
            last_exc = RuntimeError(f"Rate limited (429) by provider (attempt {attempt + 1}/4)")
            # Free/test-tier rate limits are commonly per-minute, not
            # per-second, so a sub-second retry just hits the same wall
            # again - back off further each attempt (up to ~6s on the last
            # try) to actually clear the window instead of retrying inside it.
            time.sleep(1.5 * (attempt + 1))
            continue
        resp.raise_for_status()
        return resp
    raise last_exc if last_exc else RuntimeError("Request failed after retries.")


def call_fireworks(system_prompt: str, user_prompt: str) -> str:
    if not FIREWORKS_API_KEY:
        raise RuntimeError("FIREWORKS_API_KEY not set.")
    resp = _post_with_retry(
        FIREWORKS_URL,
        headers={"Authorization": f"Bearer {FIREWORKS_API_KEY}", "Content-Type": "application/json"},
        json_body={
            "model": FIREWORKS_MODEL,
            "max_tokens": 1000,
            "temperature": SCORING_TEMPERATURE,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=30,
    )
    return resp.json()["choices"][0]["message"]["content"]


def call_featherless(system_prompt: str, user_prompt: str) -> str:
    """Calls Featherless. If NOTEBOOK_FEATHERLESS_URL is configured, the request
    goes to the local relay exposed by amd_compute/featherless_notebook_server.ipynb
    (running on the AMD Developer Cloud instance) instead of api.featherless.ai
    directly - that notebook process is what actually dispatches the outbound
    call to Featherless. If the relay isn't set or isn't reachable, this falls
    back to calling Featherless directly so the backend keeps working without
    the notebook running.
    """
    if not FEATHERLESS_API_KEY:
        raise RuntimeError("FEATHERLESS_API_KEY not set.")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    if NOTEBOOK_FEATHERLESS_URL:
        try:
            resp = _post_with_retry(
                NOTEBOOK_FEATHERLESS_URL,
                headers={"Content-Type": "application/json"},
                json_body={
                    "model": FEATHERLESS_MODEL,
                    "max_tokens": 1000,
                    "temperature": SCORING_TEMPERATURE,
                    "messages": messages,
                },
                timeout=30,
            )
            return resp.json()["choices"][0]["message"]["content"]
        except Exception:
            # Notebook relay not up / kernel not running / network hiccup -
            # fall through to calling Featherless directly rather than
            # failing the whole specialist call.
            pass

    resp = _post_with_retry(
        FEATHERLESS_URL,
        headers={"Authorization": f"Bearer {FEATHERLESS_API_KEY}", "Content-Type": "application/json"},
        json_body={
            "model": FEATHERLESS_MODEL,
            "max_tokens": 1000,
            "temperature": SCORING_TEMPERATURE,
            "messages": messages,
        },
        timeout=30,
    )
    return resp.json()["choices"][0]["message"]["content"]


# Featherless first: it is the primary live-inference provider for this
# project's hybrid architecture. Fireworks is kept as a secondary fallback
# only, in case Featherless is briefly unreachable during a live demo.
_PROVIDERS = [
    ("featherless", call_featherless),
    ("fireworks", call_fireworks),
]


def get_llm_status() -> str | None:
    """
    Tests each configured backend with a trivial ping call and returns the
    name of the first one that actually works, or None if every backend is
    offline/unreachable. Result is cached with a TTL rather than forever:
    a success is trusted for _SUCCESS_TTL_SECONDS, a failure only for
    _FAILURE_TTL_SECONDS, so a single transient blip on the first ping can't
    permanently mislabel the whole process as offline.
    """
    now = time.monotonic()
    ttl = _SUCCESS_TTL_SECONDS if _STATUS_CACHE["provider"] else _FAILURE_TTL_SECONDS
    if now - _STATUS_CACHE["checked_at"] < ttl:
        return _STATUS_CACHE["provider"]

    for name, fn in _PROVIDERS:
        try:
            fn("You are a test.", "Reply with the single word: ok")
            _STATUS_CACHE["provider"] = name
            break
        except Exception:
            continue
    else:
        _STATUS_CACHE["provider"] = None

    _STATUS_CACHE["checked_at"] = now
    return _STATUS_CACHE["provider"]


def has_llm() -> bool:
    """Honest check: is a backend actually reachable right now, not just configured."""
    return get_llm_status() is not None


def call_llm(system_prompt: str, user_prompt: str) -> str:
    """
    Calls whichever backend get_llm_status() found working. Raises a clear
    RuntimeError if none are reachable - callers should catch this and report
    'LLM OFFLINE' honestly rather than silently using a different code path.

    A small random jitter is inserted before dispatching. All 4 specialists
    call this at effectively the same instant (LangGraph fans them out in
    parallel), so without any spacing, 4 requests land in the provider's
    rate-limit window in the same fraction of a second - which is exactly
    what was causing a random single specialist to eat a 429. Spreading the
    actual dispatch times out over ~0-1.2s costs a trivial amount of wall
    time but meaningfully reduces how often multiple requests collide in the
    same rate-limit window in the first place.
    """
    provider = get_llm_status()
    if provider is None:
        raise RuntimeError("LLM_OFFLINE: no configured backend (Fireworks/Featherless) is reachable.")

    time.sleep(random.uniform(0, 1.2))

    fn = dict(_PROVIDERS)[provider]
    _LLM_CALL_COUNTER["count"] += 1
    return fn(system_prompt, user_prompt)


def extract_code_block(text: str) -> str:
    if "```python" in text:
        return text.split("```python", 1)[1].split("```", 1)[0].strip()
    if "```" in text:
        return text.split("```", 1)[1].split("```", 1)[0].strip()
    return text.strip()


def run_agent_code(code: str, patient_row: dict) -> dict:
    namespace = {"patient": patient_row, "result": None}
    try:
        exec(code, {"__builtins__": __builtins__}, namespace)
    except Exception as e:
        return {
            "risk_score": 0.0,
            "flag": False,
            "reasoning": f"[EXECUTION ERROR] {e}\n{traceback.format_exc(limit=2)}",
            "steps": [],
        }
    result = namespace.get("result")
    if not isinstance(result, dict):
        return {"risk_score": 0.0, "flag": False, "reasoning": "[ERROR] agent code did not set `result` dict", "steps": []}
    # Allow (but don't require) executed code to set a "steps" key in `result`.
    # Fallback code doesn't set it, so it defaults to an empty list here and gets
    # overridden by specialists.py with generated steps.
    result.setdefault("steps", [])

    # Defensive clamp on whatever the executed code (LLM-written or fallback)
    # actually computed for risk_score. This is NOT a hardcoded/fake output -
    # it's a post-execution guard on the AI's own numeric result, since
    # LLM-generated scoring code has no guarantee it stays inside the promised
    # 0-1 range (the fallback templates already self-clamp via min(x, 1.0), but
    # arbitrary LLM code doesn't). The real number the AI computed is preserved
    # unless it's out of contract, in which case it's bounded, never replaced.
    try:
        raw_score = float(result.get("risk_score", 0.0))
    except (TypeError, ValueError):
        raw_score = 0.0
    result["risk_score"] = max(0.0, min(1.0, raw_score))

    return result