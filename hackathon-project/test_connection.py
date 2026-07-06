"""
test_connection.py
---------------------
Quick sanity check that your local Ollama (via ngrok) is reachable and working
before running the full pipeline. Run this yourself - it won't work from Claude's
sandbox since that has its own network restrictions, only from your machine.
"""
import requests

OLLAMA_URL = "https://backshift-luckily-unsaddle.ngrok-free.dev"

resp = requests.post(
    f"{OLLAMA_URL}/v1/chat/completions",
    headers={"Content-Type": "application/json", "ngrok-skip-browser-warning": "true"},
    json={"model": "llama3.1", "messages": [{"role": "user", "content": "Say hello in exactly 5 words."}]},
    timeout=30,
)
print("Status:", resp.status_code)
print("Response:", resp.json()["choices"][0]["message"]["content"])
