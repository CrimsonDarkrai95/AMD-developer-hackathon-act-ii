"""
run_pipeline.py
------------------
The full end-to-end demo pipeline:
  1. Load patients.csv
  2. For each patient, run all 4 specialist agents
  3. Run the synthesis agent to get a referral recommendation
  4. Compare against answer_key.csv to report accuracy (for YOUR eyes only)

Usage:
    python3 run_pipeline.py                 # runs on all patients, full report
    python3 run_pipeline.py --patient P009  # runs on just one patient (good for live demo)

To use REAL Fireworks LLM agents instead of the rule-based fallback:
    export FIREWORKS_API_KEY="your-key-here"
    python3 run_pipeline.py
(Without the key set, this runs the deterministic fallback logic - fully functional
for testing/rehearsing the demo before your API key is ready.)
"""

import argparse
import pandas as pd

from specialists import SPECIALISTS, run_specialist
from synthesis_agent import synthesize
from agent_core import has_llm


def run_patient(patient_row: dict, verbose=True):
    if verbose:
        mode = "LIVE FIREWORKS LLM AGENTS" if has_llm() else "RULE-BASED FALLBACK (no API key set)"
        print(f"\n{'='*70}")
        print(f"Patient {patient_row['patient_id']}  |  Mode: {mode}")
        print(f"A1c: {patient_row['a1c_percent']}%  |  Age: {patient_row['age']}  |  "
              f"Years with diabetes: {patient_row['years_with_diabetes']}")
        print(f"{'='*70}")

    specialist_results = []
    for name in SPECIALISTS:
        result = run_specialist(name, patient_row)
        specialist_results.append(result)
        if verbose:
            flag_marker = "⚠️  FLAGGED" if result["flag"] else "   clear"
            print(f"[{name.upper():15s}] risk={result['risk_score']:.2f}  {flag_marker}")
            print(f"                  -> {result['reasoning']}")

    synthesis = synthesize(patient_row, specialist_results)
    if verbose:
        print(f"\n>>> SYNTHESIS: {synthesis['recommendation']}\n")

    return specialist_results, synthesis


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--patient", type=str, default=None, help="Run on just one patient ID, e.g. P009")
    parser.add_argument("--check-accuracy", action="store_true", help="Compare results against answer_key.csv")
    args = parser.parse_args()

    df = pd.read_csv("patients.csv")

    if args.patient:
        df = df[df["patient_id"] == args.patient]
        if df.empty:
            print(f"No patient with ID {args.patient} found.")
            return

    all_synthesis = []
    for _, row in df.iterrows():
        patient_row = row.to_dict()
        _, synthesis = run_patient(patient_row)
        all_synthesis.append({"patient_id": patient_row["patient_id"], "top_concern": synthesis["top_concern"]})

    # Accuracy check against answer key (only meaningful if you ran the full set)
    try:
        answer_df = pd.read_csv("answer_key.csv")
        results_df = pd.DataFrame(all_synthesis)
        merged = results_df.merge(answer_df, on="patient_id")
        merged["correct"] = merged["top_concern"] == merged["true_hidden_complication"]
        accuracy = merged["correct"].mean()

        print(f"\n{'#'*70}")
        print(f"ACCURACY CHECK (dev-only, don't show this comparison logic to judges as 'cheating'!)")
        print(f"{'#'*70}")
        print(merged.to_string(index=False))
        print(f"\nOverall accuracy: {accuracy:.0%}  ({merged['correct'].sum()}/{len(merged)} correct)")
    except FileNotFoundError:
        pass


if __name__ == "__main__":
    main()
