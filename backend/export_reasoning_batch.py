"""
backend/export_reasoning_batch.py
----------------------------------
Runs the live pipeline (backend/run_pipeline.py -> specialists.py ->
agent_core.py, i.e. the real live-LLM-backed multi-agent swarm) over a
batch of patients and exports each specialist's (patient_id, specialist,
reasoning, risk_score, thresholds_used) to a JSON file.

This is the connective tissue between the live backend and the AMD notebook:
it's the "export ahead of time from run_pipeline.py" step referenced in
amd_compute/README.md and in section 5 of specialist_eval_and_embeddings.ipynb.
The notebook then loads this file and runs a LOCAL model on the AMD GPU to
QA-score the reasoning text - so the AMD compute step is doing genuine work
on genuine live-backend output, not just re-issuing the same call.

Usage (from the backend/ directory, with your .env set - either
FIREWORKS_API_KEY or AMD_OLLAMA_URL, whichever provider you want live):
    python export_reasoning_batch.py --n 8
    python export_reasoning_batch.py --patient P93758 --patient P10442

Output:
    ../amd_compute/reasoning_batch_export.json

Upload that JSON file to the AMD Jupyter environment alongside the notebook
(or re-run this script from a notebook cell if the AMD instance can reach
the backend's provider directly) before running section 5 of
specialist_eval_and_embeddings.ipynb.
"""

import argparse
import json
from pathlib import Path

import pandas as pd

from run_pipeline import build_graph, run_patient
from agent_core import has_llm, get_llm_status

BACKEND_DIR = Path(__file__).resolve().parent
OUT_PATH = BACKEND_DIR.parent / "amd_compute" / "reasoning_batch_export.json"


def export(patient_ids=None, n=8):
    if not has_llm():
        raise SystemExit(
            "No LLM backend reachable (check FIREWORKS_API_KEY or AMD_OLLAMA_URL "
            "in backend/.env). This script needs the live pipeline to actually run."
        )

    df = pd.read_csv(BACKEND_DIR / "real_patients.csv")
    if patient_ids:
        df = df[df["patient_id"].isin(patient_ids)]
        if df.empty:
            raise SystemExit(f"None of {patient_ids} found in real_patients.csv")
    else:
        df = df.head(n)

    graph = build_graph()
    provider = get_llm_status()
    records = []

    for _, row in df.iterrows():
        patient_row = row.to_dict()
        final_state = run_patient(graph, patient_row, verbose=True)
        for specialist_name in ["renal", "neuropathy", "retinal", "cardiovascular"]:
            result = final_state[f"{specialist_name}_result"]
            if result.get("available", True) is False:
                continue  # nothing useful to QA-score if the specialist was unavailable
            records.append({
                "patient_id": str(patient_row["patient_id"]),
                "specialist": specialist_name,
                "reasoning": result["reasoning"],
                "risk_score": result["risk_score"],
                "flag": result["flag"],
                "thresholds_used": result.get("thresholds_used", {}),
                "provider": provider,
            })

    OUT_PATH.parent.mkdir(exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump({"provider": provider, "n_patients": len(df), "records": records}, f, indent=2)

    print(f"\nExported {len(records)} specialist reasoning records from {len(df)} patients "
          f"(provider: {provider}) -> {OUT_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--patient", action="append", dest="patient_ids", default=None,
                         help="Repeatable. Export specific patient ID(s) instead of the first N.")
    parser.add_argument("--n", type=int, default=8, help="Number of patients to export if --patient isn't given.")
    args = parser.parse_args()
    export(patient_ids=args.patient_ids, n=args.n)
