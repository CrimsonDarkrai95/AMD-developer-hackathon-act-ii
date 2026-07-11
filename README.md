<div align="center">

# 🩺 GlycoSwarm AI

**A multi-agent early-warning system for diabetic complications**

Built for **AMD Developer Hackathon: ACT II — Track 3 (Unicorn Track)**

[Live Demo](https://glycoswarm-ai.vercel.app/) · [Slide Deck](#) · [Demo Video](#)

</div>

---

## What it does

A diabetic patient's labs can look "stable" — A1c not alarming — while subtle multi-marker patterns are already predicting kidney, nerve, eye, or heart damage forming underneath. By the time it's symptomatic, the damage is often irreversible. Today's clinical review is also siloed: one specialist, one chart, one metric at a time.

**GlycoSwarm AI** runs four independent clinical specialist agents in parallel over the same lab panel, then synthesizes their findings into one ranked, actionable recommendation.

> ⚠️ GlycoSwarm screens **already-diagnosed diabetic patients** for early organ-complication risk. It does **not** diagnose diabetes itself, and it is a hackathon prototype — not a certified clinical device.

## How it works

```
Patient Selection
       │
       ▼
┌──────────────────────────────────────────┐
│   Specialist Fan-Out (parallel)           │
│                                            │
│   🫘 Renal        — eGFR, creatinine,     │
│                     urine albumin trends  │
│   🧠 Neuropathy   — years with diabetes,  │
│                     A1c                   │
│   👁 Retinal      — systolic BP, years    │
│                     with diabetes         │
│   ❤️ Cardiovascular — LDL, HDL,           │
│                     triglycerides         │
└──────────────────────────────────────────┘
       │
       ▼
   Synthesis Agent
   (ranks urgency, recommends next step)
       │
       ▼
   Dashboard Output
   (organ-risk map, live reasoning terminal,
    exportable report)
```

Each specialist doesn't call a static lookup table — it reasons out a defensible early-warning cutoff (deliberately more conservative than standard diagnostic thresholds) and writes/executes its own Python scoring code against the patient's real lab values. That reasoning is streamed live to the frontend as it happens.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python, LangGraph |
| Frontend | Next.js, React |
| Specialist logic | 4 domain-specific agents + synthesis agent |
| LLM (primary) | Gemma 4 26B — genuine on-GPU inference via Ollama/ROCm on AMD Instinct MI300X (AMD Developer Cloud) |
| LLM (fallback) | GLM 5.2 via Fireworks AI (serverless) |
| Data | Real de-identified patient data — CDC NHANES 2017–2018 |
| Backend hosting | Railway |
| Frontend hosting | Vercel |

**Provider failover is real, not cosmetic:** both providers are live-switchable via `/api/providers/select`, and if neither is reachable, the pipeline honestly reports "unavailable" — there is no rule-based fallback pretending to be AI output.

## Repository structure

```
.
├── backend/
│   ├── main.py                     # FastAPI routes (/api/analyze/*, /api/providers, /api/status, ...)
│   ├── agent_core.py                # LLM provider chain, retry/backoff, sandboxed code execution
│   ├── specialists.py                # 4 specialist system prompts + code-format rules
│   ├── synthesis_agent.py            # Synthesis agent
│   ├── report_agent.py               # Plain-language "Discovery Brief" generation
│   ├── run_pipeline.py               # LangGraph graph definition
│   ├── export_reasoning_batch.py     # Exports live pipeline output for QA scoring
│   └── .env.example
├── frontend/                          # Next.js app (dashboard, organ-risk map, provider switcher)
├── amd_compute/
│   └── specialist_eval_and_embeddings.ipynb   # On-GPU patient-embedding similarity search + Fireworks-judged QA pass
└── README.md
```

## Getting started

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Fireworks AI API key
- (Optional, for genuine on-GPU Gemma inference) An AMD Developer Cloud MI300X instance running Ollama

### Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `backend/.env`:

```
FIREWORKS_API_KEY=your_key_here
FIREWORKS_FAST_SERVERLESS_MODEL=accounts/fireworks/models/glm-5p2

AMD_OLLAMA_URL=            # e.g. http://<tunnel-or-firewalled-host>:11434/v1/chat/completions
AMD_OLLAMA_MODEL=gemma4:26b
```

> `AMD_OLLAMA_URL` is only required if you want to run inference on the genuine on-GPU Gemma path. Without it, the app runs on the Fireworks GLM provider only.

Run the backend:

```bash
uvicorn main:app --reload --port 8000
```

### (Optional) Standing up the AMD GPU provider

1. Create a ROCm droplet on AMD Developer Cloud (image: "ROCm Software").
2. SSH in and confirm the GPU is visible: `rocm-smi`
3. Install Ollama (≥ 0.22.0):
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
4. Pull the model:
   ```bash
   ollama pull gemma4:26b
   ```
5. Confirm it's running on GPU, not CPU:
   ```bash
   ollama run gemma4:26b "say ok"
   ollama ps
   ```
6. Expose port `11434` **safely** — Ollama has no built-in auth. Use an SSH tunnel or a firewall rule scoped to your backend's IP. **Never expose it publicly.**
   ```bash
   ssh -L 11434:localhost:11434 user@<droplet-ip>
   ```
7. Set `AMD_OLLAMA_URL` in `backend/.env` to the tunnel/firewalled URL.

### Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local     # point NEXT_PUBLIC_API_URL at your backend
npm run dev
```

Visit `http://localhost:3000`.

### Verifying everything works

```bash
curl http://localhost:8000/api/providers   # amd_notebook_gemma4 should show configured: true if set up
curl http://localhost:8000/api/status      # shows which provider is currently live
```

Force a specific provider and confirm it runs a full patient analysis end-to-end:

```bash
curl -X POST http://localhost:8000/api/providers/select \
  -H "Content-Type: application/json" \
  -d '{"provider": "amd_notebook_gemma4"}'
```

## What's real vs. what's prototype

✅ **Real**
- Full multi-agent pipeline (4 specialists + synthesis), live end-to-end
- Real NHANES 2017–2018 patient data, not synthetic
- Custom patient input for hypothetical cases
- Frontend/backend fully integrated and live-deployed (Railway + Vercel)
- Multi-provider failover, actually exercised via the provider switcher
- No hardcoded fallback — an unreachable LLM reports "unavailable," never a fabricated clean result

⚠️ **Prototype limitations**
- Not a certified clinical device — demo prototype only
- No auth / no production hardening yet
- Single-visit dataset — no longitudinal glucose/lab trend data per patient
- Specialist cutoffs are LLM-reasoned, not derived from peer-reviewed clinical thresholds
- Occasional reasoning-direction errors observed during testing (e.g. a specialist misreading which side of a cutoff a value falls on)

## Team

Built by **Snowfall** for AMD Developer Hackathon: ACT II, Track 3 (Unicorn Track).

## License

MIT
