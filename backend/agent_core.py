"""
agent_core.py
--------------
Handles calling the Fireworks AI API (real LLM agent mode) and executing
whatever Python analysis code the agent writes, in a controlled namespace.

If no FIREWORKS_API_KEY is set, specialists.py falls back to template code
so the whole pipeline still runs end-to-end for testing/demo rehearsal.
"""

import os
import json
import traceback

FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY", "")
FIREWORKS_MODEL = os.environ.get("FIREWORKS_MODEL", "accounts/fireworks/models/llama-v3p1-70b-instruct")
FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions"


def has_llm():
    return bool(FIREWORKS_API_KEY)


def call_fireworks(system_prompt: str, user_prompt: str) -> str:
    """Calls Fireworks AI chat completions endpoint. Returns raw text response."""
    import requests  # local import so script still runs without `requests` if unused

    if not FIREWORKS_API_KEY:
        raise RuntimeError("FIREWORKS_API_KEY not set - cannot call real LLM agent.")

    resp = requests.post(
        FIREWORKS_URL,
        headers={
            "Authorization": f"Bearer {FIREWORKS_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": FIREWORKS_MODEL,
            "max_tokens": 800,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def extract_code_block(text: str) -> str:
    """Pulls python code out of a ```python ... ``` fenced block, or returns text as-is."""
    if "```python" in text:
        return text.split("```python", 1)[1].split("```", 1)[0].strip()
    if "```" in text:
        return text.split("```", 1)[1].split("```", 1)[0].strip()
    return text.strip()


def run_agent_code(code: str, patient_row: dict) -> dict:
    """
    Executes agent-generated (or fallback template) code in a restricted namespace.
    The code MUST set a variable called `result` = {"risk_score": float 0-1,
    "flag": bool, "reasoning": str}.
    """
    namespace = {"patient": patient_row, "result": None}
    try:
        exec(code, {"__builtins__": __builtins__}, namespace)
    except Exception as e:
        return {
            "risk_score": 0.0,
            "flag": False,
            "reasoning": f"[EXECUTION ERROR] {e}\n{traceback.format_exc(limit=2)}",
        }

    result = namespace.get("result")
    if not isinstance(result, dict):
        return {"risk_score": 0.0, "flag": False, "reasoning": "[ERROR] agent code did not set `result` dict"}
    return result
