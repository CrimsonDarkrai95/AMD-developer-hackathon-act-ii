"""
synthesis_agent.py
--------------------
Takes all 4 specialist outputs for one patient and produces a single,
doctor-facing referral recommendation - the "so what" of the whole pipeline.
"""

from agent_core import has_llm, call_fireworks

SYNTHESIS_SYSTEM_PROMPT = """You are a synthesis agent for a primary care physician. You receive
risk assessments from 4 specialists (renal, neuropathy, retinal, cardiovascular) about one
diabetic patient whose A1c looks well-controlled. Your job: tell the doctor, in plain English,
which ONE complication (if any) is most urgently worth a referral, and why. Be concise (2-3
sentences). Do NOT diagnose - frame it as a referral recommendation with your confidence level."""


def synthesize(patient: dict, specialist_results: list) -> dict:
    """Combines specialist outputs. Uses LLM if available, else rule-based synthesis."""
    flagged = [r for r in specialist_results if r["flag"]]
    flagged_sorted = sorted(flagged, key=lambda r: r["risk_score"], reverse=True)

    if has_llm():
        summary_text = "\n".join(
            f"- {r['specialist']}: risk_score={r['risk_score']:.2f}, reasoning={r['reasoning']}"
            for r in specialist_results
        )
        user_prompt = (
            f"Patient A1c: {patient['a1c_percent']}% (looks well-controlled).\n"
            f"Specialist findings:\n{summary_text}\n\n"
            f"Give your referral recommendation."
        )
        try:
            text = call_fireworks(SYNTHESIS_SYSTEM_PROMPT, user_prompt)
            return {"recommendation": text.strip(), "top_concern": flagged_sorted[0]["specialist"] if flagged_sorted else "none"}
        except Exception:
            pass  # fall through to rule-based

    # Rule-based fallback synthesis
    if not flagged_sorted:
        return {
            "recommendation": (
                f"Patient {patient['patient_id']}: A1c {patient['a1c_percent']}% looks well-controlled, "
                f"and no specialist flagged elevated risk. Continue standard annual complication screening."
            ),
            "top_concern": "none",
        }

    top = flagged_sorted[0]
    others = [r["specialist"] for r in flagged_sorted[1:]]
    others_note = f" (also worth watching: {', '.join(others)})" if others else ""
    recommendation = (
        f"Patient {patient['patient_id']}: A1c {patient['a1c_percent']}% looks well-controlled, but "
        f"{top['specialist']} risk markers are elevated (confidence {top['risk_score']:.0%}) - {top['reasoning']}. "
        f"Recommend {top['specialist']} referral before the next annual screening cycle{others_note}."
    )
    return {"recommendation": recommendation, "top_concern": top["specialist"]}
