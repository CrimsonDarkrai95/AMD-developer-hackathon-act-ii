"""
Synthetic Diabetic Patient Dataset Generator
----------------------------------------------
Generates realistic-looking patient lab data for the "Diabetic Complication
Early-Warning" hackathon project.

Each patient has an A1c that looks "fine" (well-controlled), but some patients
have a hidden complication signal building in ONE specific marker group that
a single A1c glance would miss. That's your demo's whole point.

Run: python3 generate_patients.py
Output: patients.csv + answer_key.csv (for YOUR reference only, not for agents to see)
"""

import numpy as np
import pandas as pd

np.random.seed(42)  # reproducible - same patients every time you run this

N_PATIENTS = 18
COMPLICATION_TYPES = ["none", "renal", "neuropathy", "retinal", "cardiovascular"]

# How many patients get each hidden complication (rest are "none")
# 10 healthy, 2 of each complication type = 18 total
complication_assignments = (
    ["none"] * 10 +
    ["renal"] * 2 +
    ["neuropathy"] * 2 +
    ["retinal"] * 2 +
    ["cardiovascular"] * 2
)
np.random.shuffle(complication_assignments)

def make_patient(patient_id, hidden_complication):
    age = np.random.randint(45, 75)
    sex = np.random.choice(["M", "F"])
    years_with_diabetes = np.random.randint(3, 20)

    # Baseline "everything looks fine" values (well-controlled diabetic)
    a1c = round(np.random.uniform(6.3, 6.9), 1)  # looks good, under 7
    egfr = round(np.random.uniform(85, 100), 1)  # normal is roughly >90-100
    uacr = round(np.random.uniform(5, 12), 1)     # normal is < 15.5 (early cutoff)
    creatinine = round(np.random.uniform(0.7, 1.1), 2)
    ldl = round(np.random.uniform(80, 110), 1)
    hdl = round(np.random.uniform(45, 60), 1)
    triglycerides = round(np.random.uniform(100, 150), 1)
    systolic_bp = round(np.random.uniform(115, 128), 1)
    glucose_variability_cv = round(np.random.uniform(15, 25), 1)  # % coefficient of variation, lower=more stable

    # Now inject the HIDDEN signal depending on assigned complication
    # These are subtle - not wildly abnormal, just quietly drifting in the risk direction
    if hidden_complication == "renal":
        egfr = round(np.random.uniform(70, 84), 1)      # below the 84.8 early cutoff, still "not diagnosed"
        uacr = round(np.random.uniform(16, 28), 1)       # above 15.5 early cutoff, below classic 30 "abnormal"
        creatinine = round(np.random.uniform(1.1, 1.3), 2)

    elif hidden_complication == "neuropathy":
        glucose_variability_cv = round(np.random.uniform(32, 42), 1)  # high swings, A1c average still looks ok
        years_with_diabetes = np.random.randint(10, 20)  # duration is a real risk factor

    elif hidden_complication == "retinal":
        systolic_bp = round(np.random.uniform(135, 145), 1)  # elevated BP + duration = retinopathy risk
        years_with_diabetes = np.random.randint(12, 20)

    elif hidden_complication == "cardiovascular":
        ldl = round(np.random.uniform(130, 155), 1)
        hdl = round(np.random.uniform(30, 40), 1)
        triglycerides = round(np.random.uniform(180, 230), 1)

    return {
        "patient_id": f"P{patient_id:03d}",
        "age": age,
        "sex": sex,
        "years_with_diabetes": years_with_diabetes,
        "a1c_percent": a1c,
        "egfr": egfr,
        "uacr_mg_g": uacr,
        "creatinine_mg_dl": creatinine,
        "ldl_mg_dl": ldl,
        "hdl_mg_dl": hdl,
        "triglycerides_mg_dl": triglycerides,
        "systolic_bp": systolic_bp,
        "glucose_variability_cv_percent": glucose_variability_cv,
    }, hidden_complication


rows = []
answer_key = []
for i, complication in enumerate(complication_assignments, start=1):
    patient_row, true_complication = make_patient(i, complication)
    rows.append(patient_row)
    answer_key.append({"patient_id": patient_row["patient_id"], "true_hidden_complication": true_complication})

df = pd.DataFrame(rows)
answer_df = pd.DataFrame(answer_key)

df.to_csv("patients.csv", index=False)
answer_df.to_csv("answer_key.csv", index=False)

print(f"Generated {N_PATIENTS} patients -> patients.csv")
print(f"Answer key (for YOUR eyes only, don't feed to agents) -> answer_key.csv")
print("\nComplication distribution:")
print(answer_df["true_hidden_complication"].value_counts())
