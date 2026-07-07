"""
specialists.py
----------------
Defines the 4 specialist agents: renal, neuropathy, retinal, cardiovascular.

Each specialist has:
  - a system_prompt (its "clinical lens")
  - a build_user_prompt(patient) function describing the task to the LLM
  - a fallback_code(patient) template used when no Fireworks API key is set,
    so the pipeline is fully runnable/demoable without needing the API.

When FIREWORKS_API_KEY is set, the real LLM writes its own analysis code,
which then gets executed the same way the fallback code would be.
"""

import time

from agent_core import has_llm, call_llm, extract_code_block, run_agent_code


# Appended to every specialist's system prompt. Small/fast models (like 7B-class
# ones used for cheap testing) are prone to mixing plain English into code blocks,
# which causes SyntaxErrors when executed. This block exists specifically to stop
# that failure mode with blunt, repeated, unambiguous formatting instructions.
#
# NOTE: `steps` is deliberately NOT added as a required output key here. Small/
# cheap LLMs are already fragile about output format - adding a 4th required key
# risks breaking JSON/code-block compliance on 7B-class models. Steps for LLM
# runs are synthesized after the fact in Python instead (see run_specialist).
STRICT_CODE_FORMAT_INSTRUCTIONS = """

CRITICAL OUTPUT FORMAT RULES - follow these exactly:
1. Respond with ONE python code block, wrapped in ```python and ```, and NOTHING else.
2. Do NOT include any explanation, commentary, or natural-language sentences before,
   after, or INSIDE the code block. Every line inside the code block must be valid,
   executable Python - no exceptions, no "notes to self", no half-written sentences.
3. Do NOT point out typos or issues in the prompt. Do NOT comment on the patient data.
   Just write the analysis code.
4. Every line must be syntactically valid Python. If you are not fully sure a line is
   valid Python, do not include it - write simpler code instead.
5. The code MUST end by assigning a dict to a variable named exactly `result` with
   these exact keys: "risk_score" (float 0-1), "flag" (bool), "reasoning" (str).
6. Do not import any modules. Do not read files or access the network. Only use the
   `patient` dict that is already available to you.

Example of the ONLY acceptable response format:
```python
egfr = patient["egfr"]
risk_score = 0.8 if egfr < 84.8 else 0.1
result = {"risk_score": risk_score, "flag": risk_score >= 0.4, "reasoning": "eGFR is low"}
```
"""


# ---------------------------------------------------------------------------
# THRESHOLDS - single source of truth. These same values are referenced in
# each specialist's system prompt text, its fallback code, and its returned
# thresholds_used dict, so they're defined once here instead of drifting out
# of sync across three copies.
# ---------------------------------------------------------------------------
RENAL_EGFR_CUTOFF = 84.8
RENAL_UACR_CUTOFF = 15.5
RENAL_CREATININE_CUTOFF = 1.1

NEUROPATHY_YEARS_CUTOFF = 10
NEUROPATHY_A1C_CUTOFF = 6.8
NEUROPATHY_COMPOUND_YEARS_CUTOFF = 15

RETINAL_BP_CUTOFF = 130
RETINAL_YEARS_CUTOFF = 10
RETINAL_COMPOUND_BP_CUTOFF = 135
RETINAL_COMPOUND_YEARS_CUTOFF = 12

CARDIO_LDL_CUTOFF = 130
CARDIO_HDL_CUTOFF = 40
CARDIO_TRIG_CUTOFF = 150


# ---------------------------------------------------------------------------
# FIELD LISTS - which patient dict keys each specialist actually reads.
# Used to build the `input_labs` subset returned to the frontend.
# ---------------------------------------------------------------------------
RENAL_FIELDS = ["egfr", "uacr_mg_g", "creatinine_mg_dl"]
NEUROPATHY_FIELDS = ["years_with_diabetes", "a1c_percent"]
RETINAL_FIELDS = ["systolic_bp", "years_with_diabetes"]
CARDIO_FIELDS = ["ldl_mg_dl", "hdl_mg_dl", "triglycerides_mg_dl"]


# ---------------------------------------------------------------------------
# RENAL SPECIALIST
# ---------------------------------------------------------------------------
RENAL_SYSTEM_PROMPT = f"""You are a renal (kidney) specialist agent analyzing diabetic patient
lab data to catch early kidney stress BEFORE standard diagnostic thresholds are hit.
Key early-warning cutoffs you know: eGFR below ~{RENAL_EGFR_CUTOFF} mL/min/1.73m^2 (well above the
standard 60 'disease' cutoff) and UACR above ~{RENAL_UACR_CUTOFF} mg/g (below the classic 30 'abnormal'
threshold) both indicate early risk. Write Python code that reads the `patient` dict and
sets a `result` dict: {{"risk_score": float 0-1, "flag": bool, "reasoning": str}}.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

def renal_fallback_code(patient):
    intro_step = f"Read eGFR ({patient['egfr']}), UACR ({patient['uacr_mg_g']}), creatinine ({patient['creatinine_mg_dl']})"
    return f"""
egfr = {patient['egfr']}
uacr = {patient['uacr_mg_g']}
creatinine = {patient['creatinine_mg_dl']}

risk_score = 0.0
reasons = []
if egfr < {RENAL_EGFR_CUTOFF}:
    risk_score += 0.5
    reasons.append(f"eGFR {{egfr}} is below the early-risk cutoff of {RENAL_EGFR_CUTOFF}")
if uacr > {RENAL_UACR_CUTOFF}:
    risk_score += 0.4
    reasons.append(f"UACR {{uacr}} mg/g is above the early-risk cutoff of {RENAL_UACR_CUTOFF}")
if creatinine > {RENAL_CREATININE_CUTOFF}:
    risk_score += 0.1
    reasons.append(f"Creatinine {{creatinine}} mg/dL is at the upper edge of normal")

risk_score = min(risk_score, 1.0)
result = {{
    "risk_score": risk_score,
    "flag": risk_score >= 0.4,
    "reasoning": "; ".join(reasons) if reasons else "No early renal risk markers detected.",
    "steps": ([{intro_step!r}] + reasons) if reasons else [{intro_step!r}, "No cutoffs exceeded"],
}}
"""


# ---------------------------------------------------------------------------
# NEUROPATHY SPECIALIST
# ---------------------------------------------------------------------------
NEUROPATHY_SYSTEM_PROMPT = f"""You are a diabetic neuropathy risk specialist agent. You know that
longer diabetes duration and higher A1c are the strongest available predictors of nerve damage
risk in single-visit survey data (true day-to-day glucose variability isn't available here).
Write Python code that reads the `patient` dict and sets a `result` dict:
{{"risk_score": float 0-1, "flag": bool, "reasoning": str}}.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

def neuropathy_fallback_code(patient):
    intro_step = f"Read years with diabetes ({patient['years_with_diabetes']}) and A1c ({patient['a1c_percent']})"
    return f"""
years = {patient['years_with_diabetes']}
a1c = {patient['a1c_percent']}

risk_score = 0.0
reasons = []
if years > {NEUROPATHY_YEARS_CUTOFF}:
    risk_score += 0.5
    reasons.append(f"{{years:.0f}} years with diabetes increases cumulative nerve damage risk")
if a1c > {NEUROPATHY_A1C_CUTOFF}:
    risk_score += 0.3
    reasons.append(f"A1c {{a1c}}% is at the higher end of the 'controlled' range")
if years > {NEUROPATHY_COMPOUND_YEARS_CUTOFF} and a1c > {NEUROPATHY_A1C_CUTOFF}:
    risk_score += 0.2
    reasons.append("Long duration combined with A1c elevation is a compounding risk factor")

risk_score = min(risk_score, 1.0)
result = {{
    "risk_score": risk_score,
    "flag": risk_score >= 0.4,
    "reasoning": "; ".join(reasons) if reasons else "No early neuropathy risk markers detected.",
    "steps": ([{intro_step!r}] + reasons) if reasons else [{intro_step!r}, "No cutoffs exceeded"],
}}
"""


# ---------------------------------------------------------------------------
# RETINAL SPECIALIST
# ---------------------------------------------------------------------------
RETINAL_SYSTEM_PROMPT = f"""You are a diabetic retinopathy risk specialist agent. You know that
elevated blood pressure combined with longer diabetes duration is a strong predictor of retinal
damage risk, independent of glucose control. Write Python code that reads the `patient` dict
and sets a `result` dict: {{"risk_score": float 0-1, "flag": bool, "reasoning": str}}.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

def retinal_fallback_code(patient):
    intro_step = f"Read systolic BP ({patient['systolic_bp']}) and years with diabetes ({patient['years_with_diabetes']})"
    return f"""
bp = {patient['systolic_bp']}
years = {patient['years_with_diabetes']}

risk_score = 0.0
reasons = []
if bp > {RETINAL_BP_CUTOFF}:
    risk_score += 0.5
    reasons.append(f"Systolic BP of {{bp:.0f}} is elevated, a known retinopathy risk factor")
if years > {RETINAL_YEARS_CUTOFF}:
    risk_score += 0.3
    reasons.append(f"{{years:.0f}} years with diabetes increases retinal risk independent of glucose control")
if bp > {RETINAL_COMPOUND_BP_CUTOFF} and years > {RETINAL_COMPOUND_YEARS_CUTOFF}:
    risk_score += 0.1
    reasons.append("High BP plus long duration is a compounding risk pattern")

risk_score = min(risk_score, 1.0)
result = {{
    "risk_score": risk_score,
    "flag": risk_score >= 0.4,
    "reasoning": "; ".join(reasons) if reasons else "No early retinal risk markers detected.",
    "steps": ([{intro_step!r}] + reasons) if reasons else [{intro_step!r}, "No cutoffs exceeded"],
}}
"""


# ---------------------------------------------------------------------------
# CARDIOVASCULAR SPECIALIST
# ---------------------------------------------------------------------------
CARDIO_SYSTEM_PROMPT = f"""You are a cardiovascular risk specialist agent analyzing a diabetic
patient's lipid panel. Diabetics face elevated cardiovascular risk that a normal A1c does not
capture. Write Python code that reads the `patient` dict and sets a `result` dict:
{{"risk_score": float 0-1, "flag": bool, "reasoning": str}}.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

def cardio_fallback_code(patient):
    intro_step = f"Read LDL ({patient['ldl_mg_dl']}), HDL ({patient['hdl_mg_dl']}), triglycerides ({patient['triglycerides_mg_dl']})"
    return f"""
ldl = {patient['ldl_mg_dl']}
hdl = {patient['hdl_mg_dl']}
trig = {patient['triglycerides_mg_dl']}

risk_score = 0.0
reasons = []
if ldl > {CARDIO_LDL_CUTOFF}:
    risk_score += 0.4
    reasons.append(f"LDL of {{ldl}} mg/dL is elevated")
if hdl < {CARDIO_HDL_CUTOFF}:
    risk_score += 0.3
    reasons.append(f"HDL of {{hdl}} mg/dL is low (protective cholesterol too low)")
if trig > {CARDIO_TRIG_CUTOFF}:
    risk_score += 0.3
    reasons.append(f"Triglycerides of {{trig}} mg/dL are elevated")

risk_score = min(risk_score, 1.0)
result = {{
    "risk_score": risk_score,
    "flag": risk_score >= 0.4,
    "reasoning": "; ".join(reasons) if reasons else "No early cardiovascular risk markers detected.",
    "steps": ([{intro_step!r}] + reasons) if reasons else [{intro_step!r}, "No cutoffs exceeded"],
}}
"""


SPECIALISTS = {
    "renal": (RENAL_SYSTEM_PROMPT, renal_fallback_code),
    "neuropathy": (NEUROPATHY_SYSTEM_PROMPT, neuropathy_fallback_code),
    "retinal": (RETINAL_SYSTEM_PROMPT, retinal_fallback_code),
    "cardiovascular": (CARDIO_SYSTEM_PROMPT, cardio_fallback_code),
}

# Per-specialist input fields and thresholds, keyed the same as SPECIALISTS.
SPECIALIST_FIELDS = {
    "renal": RENAL_FIELDS,
    "neuropathy": NEUROPATHY_FIELDS,
    "retinal": RETINAL_FIELDS,
    "cardiovascular": CARDIO_FIELDS,
}

SPECIALIST_THRESHOLDS = {
    "renal": {
        "egfr_cutoff": RENAL_EGFR_CUTOFF,
        "uacr_cutoff": RENAL_UACR_CUTOFF,
        "creatinine_cutoff": RENAL_CREATININE_CUTOFF,
    },
    "neuropathy": {
        "years_cutoff": NEUROPATHY_YEARS_CUTOFF,
        "a1c_cutoff": NEUROPATHY_A1C_CUTOFF,
        "compound_years_cutoff": NEUROPATHY_COMPOUND_YEARS_CUTOFF,
    },
    "retinal": {
        "bp_cutoff": RETINAL_BP_CUTOFF,
        "years_cutoff": RETINAL_YEARS_CUTOFF,
        "compound_bp_cutoff": RETINAL_COMPOUND_BP_CUTOFF,
        "compound_years_cutoff": RETINAL_COMPOUND_YEARS_CUTOFF,
    },
    "cardiovascular": {
        "ldl_cutoff": CARDIO_LDL_CUTOFF,
        "hdl_cutoff": CARDIO_HDL_CUTOFF,
        "triglycerides_cutoff": CARDIO_TRIG_CUTOFF,
    },
}


def run_specialist(name: str, patient: dict) -> dict:
    """Runs one specialist agent on one patient. Uses real LLM if reachable, else fallback -
    and HONESTLY labels which one actually happened, instead of silently mislabeling.
    Retries once with error feedback if the LLM's code fails to execute, before
    giving up and using the rule-based fallback.

    Returned dict includes duration_ms, input_labs, thresholds_used, steps, and
    code_used in addition to the original risk_score/flag/reasoning/used_llm keys,
    so the frontend's Agent Logs / Analysis / Benchmark tabs have real data to show.
    """
    system_prompt, fallback_fn = SPECIALISTS[name]
    start = time.perf_counter()
    code_used = None

    if has_llm():
        user_prompt = (
            f"Analyze this patient's data for {name} risk: {patient}\n"
            f"Respond ONLY with a python code block that sets a `result` dict as instructed."
        )
        try:
            raw = call_llm(system_prompt, user_prompt)
            code = extract_code_block(raw)
            output = run_agent_code(code, patient)

            # If the generated code failed to execute, give the model ONE more
            # chance with the actual error shown to it, before falling back.
            if output["reasoning"].startswith("[EXECUTION ERROR]") or output["reasoning"].startswith("[ERROR]"):
                retry_prompt = (
                    f"{user_prompt}\n\nYour previous attempt failed with this error:\n"
                    f"{output['reasoning']}\n"
                    f"Fix it. Remember: output ONLY a valid python code block, no other text."
                )
                raw_retry = call_llm(system_prompt, retry_prompt)
                code_retry = extract_code_block(raw_retry)
                output_retry = run_agent_code(code_retry, patient)
                if not (output_retry["reasoning"].startswith("[EXECUTION ERROR]") or output_retry["reasoning"].startswith("[ERROR]")):
                    output = output_retry  # retry succeeded, use it
                    code = code_retry
                else:
                    raise RuntimeError("LLM code failed twice, falling back")

            used_llm = True
            code_used = code

            # LLM writes arbitrary code, so we can't introspect its reasoning at
            # the same granularity as the fallback path. Synthesize a real (not
            # generic) 2-line trace from the provider name and actual result,
            # unless the LLM's own code happened to set "steps" already.
            if not output.get("steps"):
                from agent_core import get_llm_status
                provider = get_llm_status()
                output["steps"] = [
                    f"LLM ({provider}) generated custom risk-scoring code",
                    f"Executed in sandbox -> risk_score={output.get('risk_score', 0.0):.2f}",
                ]
        except Exception:
            # LLM was reachable but its code didn't work even after a retry -
            # fall back, and say so honestly rather than pretending it was live.
            code = fallback_fn(patient)
            output = run_agent_code(code, patient)
            used_llm = False
            code_used = code
    else:
        code = fallback_fn(patient)
        output = run_agent_code(code, patient)
        used_llm = False
        code_used = code

    duration_ms = int((time.perf_counter() - start) * 1000)

    output["specialist"] = name
    output["used_llm"] = used_llm
    if not used_llm:
        output["reasoning"] = f"[LLM OFFLINE - rule-based fallback used] {output['reasoning']}"

    output["duration_ms"] = duration_ms
    output["input_labs"] = {k: patient[k] for k in SPECIALIST_FIELDS[name] if k in patient}
    output["thresholds_used"] = SPECIALIST_THRESHOLDS[name]
    output["code_used"] = code_used
    output.setdefault("steps", [])

    return output
