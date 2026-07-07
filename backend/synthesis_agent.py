"""
synthesis_agent.py
------------------
Chief Medical Synthesis Agent for consolidating multi-organ risk scores
and clinical recommendations.
"""

import json
import time
from agent_core import has_llm, call_llm

SYNTHESIS_SYSTEM_PROMPT = """You are the Chief Medical Synthesis Agent. You are reviewing clinical risk analysis reports from a multidisciplinary panel of diabetic organ specialists (renal, neuropathy, retinal, cardiovascular) for a single patient.

Your task is to compile these individual findings into a unified, high-level executive summary for the primary care clinician.
You must output a JSON object containing EXACTLY these two keys:
1. 'top_concern': A short string representing the primary risk domain (e.g. 'Renal (Kidney Stress)', 'Neuropathy (Nerve Degradation)', 'Retinal (Microvascular Damage)', 'Cardiovascular (Macrovascular Risk)', or 'Low overall risk').
2. 'recommendation': A clear, actionable clinical referral and management recommendation for the primary care doctor (1-2 sentences).

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


def synthesize_fallback(patient_row: dict, specialist_results: list) -> dict:
    """Deterministic, clinical-formula-based fallback compiler (no API key needed)."""
    # Filter specialists that flagged an anomaly
    flagged = [s for s in specialist_results if s.get("flag", False)]
    
    if flagged:
        # Sort flagged by risk score descending
        flagged.sort(key=lambda x: x.get("risk_score", 0.0), reverse=True)
        top = flagged[0]
    elif specialist_results:
        # Sort all by risk score descending
        sorted_specs = sorted(specialist_results, key=lambda x: x.get("risk_score", 0.0), reverse=True)
        top = sorted_specs[0]
    else:
        top = None

    if not top or (top.get("risk_score", 0.0) < 0.4 and not top.get("flag", False)):
        return {
            "top_concern": "Low overall risk",
            "recommendation": "All evaluated organ systems are within target boundary limits. Maintain standard monitoring schedules."
        }

    spec_name = top.get("specialist", "").lower()

    if spec_name == "renal":
        egfr = patient_row.get("egfr", "N/A")
        uacr = patient_row.get("uacr_mg_g", "N/A")
        recommendation = f"Refer to Nephrology. Patient exhibits early diabetic kidney stress (eGFR: {egfr} mL/min/1.73m^2, UACR: {uacr} mg/g). Optimize blood pressure, and consider initiating an ACEi/ARB or SGLT2 inhibitor."
        top_concern = "Renal (Kidney Stress)"
    elif spec_name == "neuropathy":
        years = patient_row.get("years_with_diabetes", 0)
        a1c = patient_row.get("a1c_percent", "N/A")
        recommendation = f"Refer to Neurology or Podiatry. Elevated nerve degradation risk is flagged based on diabetes duration ({years:.0f} years) and elevated HbA1c ({a1c}%). Advise daily foot self-inspections."
        top_concern = "Neuropathy (Nerve Degradation)"
    elif spec_name == "retinal":
        bp = patient_row.get("systolic_bp", 0)
        years = patient_row.get("years_with_diabetes", 0)
        recommendation = f"Refer to Ophthalmology. Microvascular retinal stress flagged based on elevated systolic blood pressure ({bp:.1f} mmHg) and a diabetes duration of {years:.0f} years. Schedule a dilated funduscopic exam."
        top_concern = "Retinal (Microvascular Damage)"
    elif spec_name == "cardiovascular" or spec_name == "cardio":
        ldl = patient_row.get("ldl_mg_dl", "N/A")
        trig = patient_row.get("triglycerides_mg_dl", "N/A")
        recommendation = f"Refer to Cardiology. Lipid panel indicates macrovascular risk (LDL: {ldl} mg/dL, Triglycerides: {trig} mg/dL). Optimize lipid-lowering therapies and discuss lifestyle modifications."
        top_concern = "Cardiovascular (Macrovascular Risk)"
    else:
        top_concern = spec_name.capitalize()
        recommendation = f"Elevated clinical indicator detected in {spec_name} system. Recommend targeted clinical review and specialist referral."

    return {
        "top_concern": top_concern,
        "recommendation": recommendation
    }


def synthesize(patient_row: dict, specialist_results: list) -> dict:
    """Entry point for the synthesis agent. Tries LLM first, falls back to deterministic rules.

    Returns {top_concern, recommendation, duration_ms, used_llm, synthesis_error}.
    synthesis_error is None unless an LLM attempt was made and failed (bad JSON,
    network error, etc.) - in which case the failure reason is surfaced instead
    of being silently swallowed, so Agent Logs can show why the fallback ran.
    """
    start = time.perf_counter()
    synthesis_error = None
    used_llm = False
    result = None

    if has_llm():
        user_prompt = (
            f"Patient Demographics: Age={patient_row.get('age')}, Sex={patient_row.get('sex')}, "
            f"HbA1c={patient_row.get('a1c_percent')}%\n"
            f"Specialist Evaluations:\n"
        )
        for res in specialist_results:
            user_prompt += (
                f"- Specialist: {res.get('specialist')}, Risk: {res.get('risk_score')}, "
                f"Flagged: {res.get('flag')}\n  Reasoning: {res.get('reasoning')}\n"
            )

        user_prompt += "\nCompile the final summary. Output ONLY a valid JSON object."

        try:
            raw_response = call_llm(SYNTHESIS_SYSTEM_PROMPT, user_prompt)
            result = extract_json(raw_response)
            used_llm = True
        except Exception as e:
            # Previously a silent `except Exception: pass`. Now the reason a
            # live LLM synthesis attempt failed (malformed JSON, network error,
            # etc.) is captured instead of disappearing.
            synthesis_error = str(e)

    if result is None:
        result = synthesize_fallback(patient_row, specialist_results)
        used_llm = False

    duration_ms = int((time.perf_counter() - start) * 1000)
    result["duration_ms"] = duration_ms
    result["used_llm"] = used_llm
    result["synthesis_error"] = synthesis_error
    return result
