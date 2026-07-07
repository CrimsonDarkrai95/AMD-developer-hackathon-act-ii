"""
backend/main.py
------------------
FastAPI server wrapping the NHANES multi-agent pipeline.
Provides web endpoints for the Next.js frontend.
"""

import os
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import the patient execution pipeline straight from your engineer's script
from run_pipeline import run_patient, build_graph

BACKEND_DIR = Path(__file__).resolve().parent

# Compile the LangGraph agent orchestration flow
graph_flow = build_graph()

app = FastAPI(title="Diabetic Complication Swarm Engine API")

# Allow your Next.js frontend workspace to fetch data securely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to ["http://localhost:3000"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the patient dataset into memory for instant lookup queries
try:
    PATIENTS_DF = pd.read_csv(BACKEND_DIR / "real_patients.csv")
except Exception as e:
    print(f"[CRITICAL] Could not read real_patients.csv: {e}")
    PATIENTS_DF = pd.DataFrame()


class PatientAnalysisResponse(BaseModel):
    patient_id: str
    demographics: dict
    labs: dict
    specialists: list
    synthesis: dict


@app.get("/api/patients")
def list_patients():
    """Returns a list of all available sample patients for the UI dropdown selection."""
    if PATIENTS_DF.empty:
        return []
    # Return basic data columns to populate your frontend dashboard selectors
    return PATIENTS_DF[["patient_id", "age", "sex", "a1c_percent"]].to_dict(orient="records")


@app.post("/api/analyze/{patient_id}", response_model=PatientAnalysisResponse)
def analyze_patient(patient_id: str):
    """Triggers the full multi-agent code execution loop for a single patient."""
    if PATIENTS_DF.empty:
        raise HTTPException(status_code=500, detail="Patient file database uninitialized.")

    # Query the targeted row
    match = PATIENTS_DF[PATIENTS_DF["patient_id"] == patient_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    patient_row = match.iloc[0].to_dict()

    try:
        # Run the end-to-end evaluation pipeline (Executes agents + synthesis code blocks)
        final_state = run_patient(graph_flow, patient_row, verbose=False)
        
        specialist_results = [
            final_state["renal_result"],
            final_state["neuropathy_result"],
            final_state["retinal_result"],
            final_state["cardiovascular_result"],
        ]
        synthesis_report = final_state["synthesis"]

        return {
            "patient_id": str(patient_row["patient_id"]),
            "demographics": {
                "age": int(patient_row["age"]),
                "sex": str(patient_row["sex"]),
                "a1c_percent": float(patient_row["a1c_percent"]),
            },
            "labs": {
                "egfr": float(patient_row["egfr"]),
                "uacr_mg_g": float(patient_row["uacr_mg_g"]),
                "creatinine_mg_dl": float(patient_row["creatinine_mg_dl"]),
                "ldl_mg_dl": float(patient_row["ldl_mg_dl"]),
                "hdl_mg_dl": float(patient_row["hdl_mg_dl"]),
                "triglycerides_mg_dl": float(patient_row["triglycerides_mg_dl"]),
                "systolic_bp": float(patient_row["systolic_bp"]),
            },
            "specialists": specialist_results,
            "synthesis": synthesis_report,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution breakdown: {str(e)}")


@app.get("/api/status")
def get_status():
    """Returns the current LLM status of the backend (fireworks, featherless, or offline)."""
    from agent_core import get_llm_status
    provider = get_llm_status()
    return {
        "llm_status": "offline" if provider is None else provider
    }


if __name__ == "__main__":
    import uvicorn
    # Fires up the server on port 8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)