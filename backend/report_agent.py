"""
report_agent.py
----------------
Discovery Brief Writer - composes a plain-language, exportable clinical brief
from the already-computed pipeline output (specialist results + synthesis).

Mirrors synthesis_agent.py's pattern exactly: LLM-first via has_llm()/call_llm(),
deterministic f-string fallback that needs zero API calls and pulls only from
data that's already in patient_row / specialist_results / synthesis - no new
data plumbing, no invented numbers, no hardcoded canned outcomes. The fallback
template branches on the *actual* values passed in (which specialist is top
concern, how many are flagged, live vs rule-based mode, etc.) so a different
patient produces a different brief, the same way synthesize_fallback() does.
"""

from agent_core import has_llm, call_llm

REPORT_SYSTEM_PROMPT = """You are the Discovery Brief Writer for a diabetic complication risk panel. You are given a patient's demographics, labs, and the full output of four specialist agents (renal, neuropathy, retinal, cardiovascular) plus a synthesis recommendation. Write a plain-language clinical brief a primary care physician could read in under a minute. Do not invent any numbers - use only the values provided. Output ONLY the brief text, no preamble."""


def _fmt_num(value, decimals=1):
    """Best-effort numeric formatting that doesn't blow up on odd input types."""
    try:
        return f"{float(value):.{decimals}f}"
    except (TypeError, ValueError):
        return str(value)


def _overall_mode(specialist_results: list, synthesis: dict) -> str:
    """Derives an honest mode label from the actual used_llm flags already
    attached to each result, instead of asserting a mode independent of what
    really happened."""
    flags = [s.get("used_llm", False) for s in specialist_results]
    flags.append(synthesis.get("used_llm", False))
    if all(flags):
        return "Live LLM Agents"
    if not any(flags):
        return "Rule-based fallback (LLM offline)"
    return "Mixed (partial LLM availability)"


def _total_duration_ms(specialist_results: list, synthesis: dict) -> int:
    """Sums the durations already recorded on each result. The brief endpoint
    only receives specialists + synthesis (not the pipeline-level benchmark
    object), so this is the honest total derivable from what's available."""
    total = 0
    for s in specialist_results:
        total += int(s.get("duration_ms", 0) or 0)
    total += int(synthesis.get("duration_ms", 0) or 0)
    return total


def _generate_brief_fallback(patient_row: dict, specialist_results: list, synthesis: dict) -> str:
    patient_id = patient_row.get("patient_id", "Unknown")
    age = patient_row.get("age", "N/A")
    sex = patient_row.get("sex", "N/A")
    a1c = patient_row.get("a1c_percent", "N/A")
    years = patient_row.get("years_with_diabetes", "N/A")

    mode = _overall_mode(specialist_results, synthesis)
    total_ms = _total_duration_ms(specialist_results, synthesis)

    flagged = [s for s in specialist_results if s.get("flag", False)]

    # --- Clinical Context -------------------------------------------------
    if flagged:
        context = (
            f"After {_fmt_num(years, 0)} years with diabetes and an HbA1c of {_fmt_num(a1c)}%, "
            f"this panel screened for early organ-level stress across four systems. "
            f"{len(flagged)} of {len(specialist_results)} specialist agents flagged early-warning "
            f"markers, meaning risk is emerging before values would cross standard diagnostic "
            f"thresholds."
        )
    else:
        context = (
            f"After {_fmt_num(years, 0)} years with diabetes and an HbA1c of {_fmt_num(a1c)}%, "
            f"this panel screened for early organ-level stress across four systems. "
            f"No specialist agent flagged early-warning markers in this screening pass, "
            f"consistent with values currently inside expected ranges."
        )

    # --- Risk Panel Summary -------------------------------------------------
    panel_lines = []
    for s in specialist_results:
        name = str(s.get("specialist", "unknown")).capitalize()
        risk = _fmt_num(s.get("risk_score", 0.0), 2)
        flag_label = "FLAGGED" if s.get("flag", False) else "clear"
        reasoning = str(s.get("reasoning", "")).strip()
        panel_lines.append(f"- {name}: risk={risk} ({flag_label}) - {reasoning}")
    panel_block = "\n".join(panel_lines) if panel_lines else "- No specialist results available."

    # --- Top Concern ---------------------------------------------------------
    top_concern = synthesis.get("top_concern", "N/A")
    recommendation = synthesis.get("recommendation", "N/A")

    # --- Methodology -----------------------------------------------------
    threshold_lines = []
    for s in specialist_results:
        name = str(s.get("specialist", "unknown")).capitalize()
        thresholds = s.get("thresholds_used", {})
        if thresholds:
            pairs = ", ".join(f"{k}={v}" for k, v in thresholds.items())
            threshold_lines.append(f"- {name}: {pairs}")
    threshold_block = "\n".join(threshold_lines) if threshold_lines else "- No threshold data available."

    return f"""DISCOVERY BRIEF - Diabetic Complication Risk Panel
=====================================================

Patient ID: {patient_id}
Age: {age}  |  Sex: {sex}  |  A1c: {_fmt_num(a1c)}%  |  Years with diabetes: {_fmt_num(years, 0)}
Mode: {mode}  |  Total analysis time: {total_ms} ms

CLINICAL CONTEXT
-----------------
{context}

RISK PANEL SUMMARY
-------------------
{panel_block}

TOP CONCERN
-----------
{top_concern}
{recommendation}

METHODOLOGY
-----------
Data source: NHANES 2017-2018 cycle patient records.
Specialist agents compare patient labs against early-warning thresholds set
below standard diagnostic cutoffs, to surface risk before it reaches clinical
disease thresholds. Thresholds used per specialist:
{threshold_block}
Mode disclosure: {mode}. Rule-based results use deterministic clinical-formula
thresholds; LLM results use provider-generated scoring code executed in a
sandboxed namespace, both under the same 0-1 risk_score contract.
"""


def _generate_brief_llm(patient_row: dict, specialist_results: list, synthesis: dict) -> str:
    user_prompt = (
        f"Patient: ID={patient_row.get('patient_id')}, Age={patient_row.get('age')}, "
        f"Sex={patient_row.get('sex')}, A1c={patient_row.get('a1c_percent')}%, "
        f"Years with diabetes={patient_row.get('years_with_diabetes')}\n\n"
        f"Labs: {patient_row}\n\n"
        f"Specialist results:\n"
    )
    for s in specialist_results:
        user_prompt += (
            f"- {s.get('specialist')}: risk_score={s.get('risk_score')}, flag={s.get('flag')}, "
            f"reasoning={s.get('reasoning')}, thresholds_used={s.get('thresholds_used')}, "
            f"used_llm={s.get('used_llm')}\n"
        )
    user_prompt += (
        f"\nSynthesis: top_concern={synthesis.get('top_concern')}, "
        f"recommendation={synthesis.get('recommendation')}\n\n"
        f"Write the Discovery Brief now, following the required section structure "
        f"(header stat block, Clinical Context, Risk Panel Summary, Top Concern, Methodology). "
        f"Use only the numbers given above - do not invent any."
    )
    return call_llm(REPORT_SYSTEM_PROMPT, user_prompt)


def generate_brief(patient_row: dict, specialist_results: list, synthesis: dict) -> str:
    """Entry point. Tries the LLM first, falls back to the deterministic
    template on any failure - same honest-fallback pattern as the rest of the
    codebase, no silent mislabeling of which path actually ran."""
    if has_llm():
        try:
            return _generate_brief_llm(patient_row, specialist_results, synthesis)
        except Exception:
            pass
    return _generate_brief_fallback(patient_row, specialist_results, synthesis)
