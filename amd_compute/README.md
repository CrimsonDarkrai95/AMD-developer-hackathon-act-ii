# AMD Compute Workflow — Offline Patient-Similarity & Specialist-Reasoning Evaluation

This folder is the Track 3 deliverable: it runs on the AMD Developer Cloud Jupyter
environment and is a genuine, complementary part of the project's workflow — it is
**not** a duplicate of the live backend inference path.

## Why this exists (hybrid architecture)

The live product (`backend/agent_core.py`) calls the **Featherless API** for the
four specialist agents and the synthesis agent. That live path is unchanged.

The AMD notebook (`specialist_eval_and_embeddings.ipynb`) runs a **separate, offline
model** directly on the AMD GPU to do two things the live path doesn't do:

1. **Patient-similarity embeddings** — encodes every patient in
   `backend/real_patients.csv` into a vector (via a sentence-embedding model run
   locally on the AMD GPU) so the dashboard can eventually show "similar patients"
   context next to a risk result. Saved as `outputs/patient_embeddings.npy` +
   `outputs/patient_index.json`.
2. **Offline reasoning-quality evaluation** — takes a batch of specialist reasoning
   text produced by the live Featherless pipeline (exported ahead of time from
   `run_pipeline.py`) and scores it locally on AMD hardware against a fixed rubric
   (does it cite the actual lab values, does it stay within the stated risk domain,
   is it internally consistent with the numeric risk_score). This gives the team an
   automated, repeatable QA signal that doesn't depend on the live API at demo time.

Both tasks are genuinely useful, genuinely run on AMD hardware, and are genuinely
separate from the live agent — they're not a thin wrapper around Featherless.

## How judges can verify AMD usage

- The notebook itself (`specialist_eval_and_embeddings.ipynb`) contains a first
  cell that prints `rocm-smi` / `torch.cuda` (ROCm build) device info — run this
  cell first when demoing, and its output should be included in the committed
  notebook (do not clear outputs before committing).
- All artifacts the notebook produces are written to `amd_compute/outputs/` and
  committed to the repo:
  - `outputs/patient_embeddings.npy`, `outputs/patient_index.json`
  - `outputs/reasoning_eval_report.json` (per-sample scores + aggregate summary)
  - `outputs/run_log.txt` (stdout capture of the notebook run, including the
    device-info cell output and timing for each stage)
- The video demo should show the notebook actively running on the AMD Developer
  Cloud environment (not locally) for at least the device-info + embedding cells,
  then cut to the committed `outputs/` artifacts as proof the run completed.

## Folder contents

- `specialist_eval_and_embeddings.ipynb` — the notebook itself
- `outputs/` — committed artifacts from the last notebook run (logs + results)
- `requirements.txt` — Python deps for the AMD notebook environment (separate from
  `backend/requirements.txt` since this runs in a different environment)

## Relationship to the live backend

| | Live backend (`backend/agent_core.py`) | AMD notebook (`amd_compute/`) |
|---|---|---|
| Where it runs | Wherever the FastAPI server is hosted | AMD Developer Cloud Jupyter |
| Model | Featherless API (hosted) | Local model loaded in-notebook |
| Purpose | Real-time specialist risk scoring for the demo | Offline similarity search + QA scoring |
| Required for the demo to function | Yes | No — it's a complementary offline artifact |
