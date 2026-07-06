# Diabetic Complication Early-Warning System

## What this is
A working, tested pipeline: reads diabetic patient labs -> 4 specialist AI agents
each assess a different complication risk -> a synthesis agent gives the doctor
a plain-English referral recommendation. Built for the AMD Unicorn Track hackathon.

## Files
- `generate_patients.py` — generates the synthetic patient dataset (already run once,
  outputs are included below, but rerun anytime for a fresh batch)
- `patients.csv` — 18 synthetic patients, ready to use
- `answer_key.csv` — which patient has which hidden complication (dev-only, don't show to judges/agents)
- `agent_core.py` — handles calling the real Fireworks LLM API + executing agent code safely
- `specialists.py` — the 4 specialist agents (renal, neuropathy, retinal, cardiovascular)
- `synthesis_agent.py` — combines specialist outputs into one referral recommendation
- `run_pipeline.py` — the main script that runs everything end-to-end

## How to run it RIGHT NOW (no API key needed)
```
pip install pandas numpy requests
python3 run_pipeline.py
```
This runs on all 18 patients using rule-based fallback logic (already tested,
100% accuracy against the answer key) and prints a full report + accuracy check.

To demo just one patient live (good for the pitch):
```
python3 run_pipeline.py --patient P009
```

## How to switch to REAL Fireworks LLM agents (do this once you have hackathon API access)
```
export FIREWORKS_API_KEY="your-actual-key"
python3 run_pipeline.py
```
That's it — nothing else changes. The specialists will now have the LLM write and
execute its own analysis code live, instead of using the fallback template. If the
API call fails for any reason (bad key, rate limit, etc), it automatically falls
back to the rule-based version so the demo never just crashes.

You may need to change `FIREWORKS_MODEL` in `agent_core.py` to whatever model
name the hackathon actually gives you access to.

## What's left to build (the actual remaining work)
1. **Frontend/demo display** — right now this is a command-line tool. For the actual
   stage demo, you want something visual: a simple web page or Jupyter notebook
   view that shows each specialist "thinking" and the CSV data, live. This is the
   biggest remaining piece.
2. **AMD infra hookup** — confirm with organizers whether Fireworks credits route
   through AMD GPUs directly, or whether you need to also run something locally via
   ROCm to satisfy the "use of AMD platforms" judging criterion.
3. **Rehearse the demo narrative** — practice explaining WHY this matters (busy
   generalist doctor needs specialist-level synthesis) before diving into the tech.
4. **Optional: tune the LLM prompts** — once you have real API access, the specialist
   system prompts in `specialists.py` are a good starting point but may need
   iteration to get the LLM writing clean, working pandas code consistently.

## Known limitations (be upfront about these if judges ask)
- Data is fully synthetic, not real patient data (intentional — avoids
  privacy/access issues, and lets the demo be reliable).
- The rule-based fallback logic uses real clinical reference ranges (eGFR/UACR
  early cutoffs, lipid panel thresholds, etc.) but is NOT a validated medical
  tool — frame it as a hackathon prototype/proof-of-concept, not clinical software.
