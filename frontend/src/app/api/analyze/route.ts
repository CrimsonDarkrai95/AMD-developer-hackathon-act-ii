
/**
 * Orchestrator route.
 *
 * Combines:
 *  1. The specialist panel output (proxied via /api/specialist, which
 *     tunnels to the remote Ollama endpoint), and
 *  2. The synthesis-agent output produced on the AMD Developer Cloud
 *     notebook runner (backend/agents/synthesis_agent.py, invoked via
 *     the backend gateway).
 *
 * and returns a single merged risk assessment payload to the dashboard.
 */