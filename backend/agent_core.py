"""
agent_core.py
--------------
Handles calling an LLM agent and executing Python analysis code the agent writes.

Uses Fireworks AI as the main provider and supports AMD notebook relay providers.
Provider connectivity is verified with cached checks.
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

# Fireworks AI - the MAIN, required LLM provider for the live backend.
# Pulled from the FIREWORKS_API_KEY environment variable (set it in
# backend/.env, which is gitignored - see backend/.env.example for the
# expected keys).
FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY", "")
FIREWORKS_MODEL = os.environ.get("FIREWORKS_MODEL", "accounts/fireworks/models/llama-v3p1-70b-instruct")
FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions"

# NOTEBOOK_RELAY_URL - the AMD Developer Cloud notebook relay endpoint,
# exposed by amd_compute/amd_notebook_relay_server.ipynb. KEEP THIS VAR when
# deleting Featherless: it is used by call_amd_notebook_qwen/gemma below for
# genuine on-GPU inference, unrelated to Featherless. Only its use *inside*
# call_featherless() as a fallback goes away with that block.
NOTEBOOK_RELAY_URL = os.environ.get("NOTEBOOK_RELAY_URL", "")

# FEATHERLESS (TESTING ONLY) - a testing-only secondary provider removed before final submission.
FEATHERLESS_API_KEY = os.environ.get("FEATHERLESS_API_KEY", "")
FEATHERLESS_MODEL = os.environ.get("FEATHERLESS_MODEL", "Qwen/Qwen2.5-7B-Instruct")
FEATHERLESS_URL = "https://api.featherless.ai/v1/chat/completions"

# Cache connectivity checks so we don't ping the provider on every single
# specialist call. A success is cached for a long time (a working provider
# rarely needs re-verifying); a failure is cached only briefly, since a
# transient blip on the very first ping shouldn't lock the whole server
# process into "offline" for its entire lifetime.
_STATUS_CACHE = {"checked_at": 0.0, "provider": None}
_SUCCESS_TTL_SECONDS = 300   # re-verify a healthy provider every 5 minutes
_FAILURE_TTL_SECONDS = 15    # retry quickly after a failure instead of forever

# Tracks which literal route served the most recent AMD-notebook-relay call
# (e.g. which Ollama model), so the Benchmark tab / console output can show
# specifically which route served the last request rather than just a
# provider name.
_FEATHERLESS_ROUTE = {"route": None}

# Manual provider override (set via POST /api/providers/select from the
# frontend's provider switcher, or set_forced_provider() directly). When
# None, get_llm_status()/call_llm() use the normal auto-failover chain
# (_PROVIDERS). When set to one of PROVIDER_IDS, only that provider is tried -
# no silent failover to a different one - so switching to e.g. "fireworks" in
# the UI actually guarantees Fireworks is what runs, not just "tried first".
_FORCED_PROVIDER = {"value": None}

# Provider IDs in display order. AMD notebook providers are manual-only.
PROVIDER_IDS = ["fireworks", "featherless", "amd_notebook_qwen", "amd_notebook_gemma"]

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


def _post_with_retry(url: str, headers: dict, json_body: dict, timeout: int = 60) -> "requests.Response":
    """POST with retry for transient network/provider issues such as 429s.

    This decreases the chance that one parallel specialist call fails due to
    a rate-limit spike while the others succeed.
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
        timeout=60,
    )
    return resp.json()["choices"][0]["message"]["content"]


# ============================================================================
# === FEATHERLESS (TESTING ONLY) — DELETE THIS ENTIRE FUNCTION BEFORE     ===
# === FINAL SUBMISSION. See DELETE_FEATHERLESS.md for the full checklist. ===
# ============================================================================
def call_featherless(system_prompt: str, user_prompt: str) -> str:
    """Calls Featherless for testing, falling back to the notebook relay if needed."""
    if not FEATHERLESS_API_KEY:
        raise RuntimeError("FEATHERLESS_API_KEY not set.")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
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
        _FEATHERLESS_ROUTE["route"] = "direct"
        return resp.json()["choices"][0]["message"]["content"]
    except Exception:
        # Direct call failed - fall back to the AMD notebook relay if one is
        # configured and reachable. If it isn't, re-raise so call_llm() can
        # move on to the next provider in _PROVIDERS (Fireworks).
        if not NOTEBOOK_RELAY_URL:
            raise
        resp = _post_with_retry(
            NOTEBOOK_RELAY_URL,
            headers={"Content-Type": "application/json"},
            json_body={
                "model": FEATHERLESS_MODEL,
                "max_tokens": 1000,
                "temperature": SCORING_TEMPERATURE,
                "messages": messages,
            },
            timeout=30,
        )
        _FEATHERLESS_ROUTE["route"] = "notebook_fallback"
        return resp.json()["choices"][0]["message"]["content"]
# === END FEATHERLESS (TESTING ONLY) call_featherless() ===
# ============================================================================


# Model tag each Ollama-backed live provider sends to the notebook relay.
# amd_notebook_relay_server.ipynb checks incoming "model" against this set:
# if it matches, the relay runs that model LOCALLY via Ollama on the AMD
# instance's GPU (genuine on-device compute) instead of forwarding to
# Featherless. Keys match PROVIDER_IDS below 1:1.
#
# "qwen2.5-coder:7b" (swapped from "llama3") - see PROVIDER_IDS comment above
# for why: this pipeline needs a model that reliably writes valid, executable
# Python, not just reasonable clinical judgment in prose.
NOTEBOOK_OLLAMA_MODELS = {
    "amd_notebook_qwen": "qwen2.5-coder:7b",
    "amd_notebook_gemma": "gemma2",
}


def call_amd_notebook_ollama(system_prompt: str, user_prompt: str, model_name: str) -> str:
    """Calls the AMD Developer Cloud notebook relay and asks it to run
    `model_name` LOCALLY via Ollama on that instance's GPU - this is genuine
    live AMD compute, not a Featherless relay. Used when a user manually picks
    "AMD Notebook - Llama 3" or "AMD Notebook - Gemma 2" in the provider
    switcher. No fallback after this - if the notebook or Ollama isn't up,
    this raises and the UI shows the provider as unreachable, same as any
    other manually-forced provider.
    """
    if not NOTEBOOK_RELAY_URL:
        raise RuntimeError(
            "NOTEBOOK_RELAY_URL not set - start "
            "amd_compute/amd_notebook_relay_server.ipynb on your AMD Developer "
            "Cloud instance (with Ollama serving llama3/gemma2) and set "
            "NOTEBOOK_RELAY_URL in backend/.env."
        )
    resp = _post_with_retry(
        NOTEBOOK_RELAY_URL,
        headers={"Content-Type": "application/json"},
        json_body={
            "model": model_name,
            "max_tokens": 1000,
            "temperature": SCORING_TEMPERATURE,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        # Local on-GPU generation is slower than a hosted API - give it more room.
        timeout=90,
    )
    _FEATHERLESS_ROUTE["route"] = f"notebook_ollama_{model_name}"
    return resp.json()["choices"][0]["message"]["content"]


def call_amd_notebook_qwen(system_prompt: str, user_prompt: str) -> str:
    return call_amd_notebook_ollama(system_prompt, user_prompt, NOTEBOOK_OLLAMA_MODELS["amd_notebook_qwen"])


def call_amd_notebook_gemma(system_prompt: str, user_prompt: str) -> str:
    return call_amd_notebook_ollama(system_prompt, user_prompt, NOTEBOOK_OLLAMA_MODELS["amd_notebook_gemma"])


# Fireworks is the main provider. Featherless is a testing-only fallback.
# AMD notebook providers are not auto-failover; they run only when forced.
_PROVIDERS = [
    ("fireworks", call_fireworks),
    ("featherless", call_featherless),  # FEATHERLESS (TESTING ONLY)
]

# Every selectable provider's actual call function, including amd_notebook -
# used by call_llm() when a manual override is active, and by get_llm_status()
# when testing a single forced provider instead of the auto chain.
_ALL_PROVIDER_FNS = dict(_PROVIDERS + [
    ("amd_notebook_qwen", call_amd_notebook_qwen),
    ("amd_notebook_gemma", call_amd_notebook_gemma),
])


def set_forced_provider(provider: str | None) -> None:
    """Manually pin call_llm()/get_llm_status() to a single provider (one of
    PROVIDER_IDS), or pass None to go back to the normal auto-failover chain.
    Invalidates the cached status immediately so the next call/status check
    actually re-tests under the new selection instead of serving a stale
    result from before the switch.
    """
    if provider is not None and provider not in PROVIDER_IDS:
        raise ValueError(f"Unknown provider '{provider}'. Must be one of {PROVIDER_IDS} or None.")
    _FORCED_PROVIDER["value"] = provider
    _STATUS_CACHE["checked_at"] = 0.0
    _STATUS_CACHE["provider"] = None


def get_forced_provider() -> str | None:
    return _FORCED_PROVIDER["value"]


def get_llm_status() -> str | None:
    """Returns the first reachable provider, caching results briefly.

    If a provider is forced, only it is tested.
    """
    forced = _FORCED_PROVIDER["value"]
    now = time.monotonic()
    ttl = _SUCCESS_TTL_SECONDS if _STATUS_CACHE["provider"] else _FAILURE_TTL_SECONDS
    if now - _STATUS_CACHE["checked_at"] < ttl:
        return _STATUS_CACHE["provider"]

    candidates = [(forced, _ALL_PROVIDER_FNS[forced])] if forced else _PROVIDERS
    for name, fn in candidates:
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


def get_provider_detail() -> str | None:
    """Returns a human-readable provider status string, including the active route."""
    provider = get_llm_status()
    if provider is None:
        return None
    if provider == "featherless":
        route = _FEATHERLESS_ROUTE.get("route")
        if route == "notebook_fallback":
            return "featherless (AMD notebook fallback)"
        return "featherless (direct)"
    if provider in NOTEBOOK_OLLAMA_MODELS:
        model_name = NOTEBOOK_OLLAMA_MODELS[provider]
        return f"{model_name} (AMD notebook, local Ollama on-GPU)"
    return provider


def call_llm(system_prompt: str, user_prompt: str) -> str:
    """
    Calls the currently available provider, or raises if none are reachable.
    A small jitter reduces parallel rate-limit collisions.
    """
    provider = get_llm_status()
    if provider is None:
        raise RuntimeError("LLM_OFFLINE: no configured backend (Fireworks/Featherless/AMD notebook) is reachable.")

    time.sleep(random.uniform(0, 1.2))

    fn = _ALL_PROVIDER_FNS[provider]
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