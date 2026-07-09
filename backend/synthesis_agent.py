"""
synthesis_agent.py
------------------
Chief Medical Synthesis Agent for consolidating multi-organ risk scores
and clinical recommendations.

No hardcoded/deterministic fallback: if no LLM is reachable, or the LLM
attempt fails (bad JSON, network error, etc.), synthesis is honestly reported
as unavailable rather than compiled from a fixed decision-tree template.
"""

import json
import time
from agent_core import has_llm, call_llm

SYNTHESIS_SYSTEM_PROMPT = """You are the Chief Medical Synthesis Agent. You are reviewing clinical risk analysis reports from a multidisciplinary panel of diabetic organ specialists (renal, neuropathy, retinal, cardiovascular) for a single patient.

Some specialists may be marked unavailable (no analysis was performed for them) - do not invent findings for an unavailable specialist, and note in your recommendation if the picture is incomplete because of it.

Your task is to compile the available findings into a unified, high-level executive summary for the primary care clinician.
You must output a JSON object containing EXACTLY these two keys:
1. 'top_concern': A short string representing the primary risk domain (e.g. 'Renal (Kidney Stress)', 'Neuropathy (Nerve Degradation)', 'Retinal (Microvascular Damage)', 'Cardiovascular (Macrovascular Risk)', or 'Low overall risk').
2. 'recommendation': A clear, actionable clinical referral and management recommendation for the primary care doctor (1-2 sentences), referencing the actual risk scores/reasoning given below.

Your output MUST be a valid JSON object. Do not include markdown code block formatting in your JSON.
"""


def extract_json(text: str) -> dict:
    """Helper to safely extract JSON from LLM string output."""
    cleaned = text.strip()
    # Remove markdown code blocks if present
    if cleaned.startswith("```"):
        if "json" in cleaned[:10]:
            cleaned = cleaned.split("json", 1)[1]
        else:
            cleaned = cleaned.split("```", 1)[1]
        cleaned = cleaned.split("```", 1)[0].strip()

    try:
        return json.loads(cleaned)
    except Exception:
        # Fallback to scanning for bounds
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            return json.loads(cleaned[start:end+1])
        raise ValueError("No valid JSON found in LLM response.")


def synthesize(patient_row: dict, specialist_results: list) -> dict:
    """Entry point for the synthesis agent. LLM-only - no rule-based fallback.

    Returns {top_concern, recommendation, available, duration_ms, used_llm,
    synthesis_error}. When unavailable, top_concern/recommendation are None
    (not a fabricated "Low overall risk" default) and synthesis_error explains
    why, so the frontend can show an honest unavailable state instead of a
    fake all-clear.
    """
    start = time.perf_counter()

    if not has_llm():
        duration_ms = int((time.perf_counter() - start) * 1000)
        return {
            "top_concern": None,
            "recommendation": None,
            "available": False,
            "duration_ms": duration_ms,
            "used_llm": False,
            "synthesis_error": "No LLM backend (Fireworks/Featherless) is currently reachable.",
        }

    user_prompt = (
        f"Patient Demographics: Age={patient_row.get('age')}, Sex={patient_row.get('sex')}, "
        f"HbA1c={patient_row.get('a1c_percent')}%\n"
        f"Specialist Evaluations:\n"
    )
    for res in specialist_results:
        if res.get("available", True) is False:
            user_prompt += f"- Specialist: {res.get('specialist')}, UNAVAILABLE ({res.get('reasoning')})\n"
        else:
            user_prompt += (
                f"- Specialist: {res.get('specialist')}, Risk: {res.get('risk_score')}, "
                f"Flagged: {res.get('flag')}\n  Reasoning: {res.get('reasoning')}\n"
            )

    user_prompt += "\nCompile the final summary. Output ONLY a valid JSON object."

    try:
        raw_response = call_llm(SYNTHESIS_SYSTEM_PROMPT, user_prompt)
        result = extract_json(raw_response)
        duration_ms = int((time.perf_counter() - start) * 1000)
        result["available"] = True
        result["duration_ms"] = duration_ms
        result["used_llm"] = True
        result["synthesis_error"] = None
        return result
    except Exception as e:
        duration_ms = int((time.perf_counter() - start) * 1000)
        return {
            "top_concern": None,
            "recommendation": None,
            "available": False,
            "duration_ms": duration_ms,
            "used_llm": False,
            "synthesis_error": str(e),
        }
