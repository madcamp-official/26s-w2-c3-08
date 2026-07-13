# Qwen Prompt Server

FastAPI gateway for refining a user image and prompt into a WAN-ready 2D platformer sprite prompt through a local Qwen2-VL vLLM server.

## Local Layout

- Track source in this repository under `qwen-prompt-server/`.
- Deploy runtime files to `/opt/qwen-prompt-server`.
- Keep the real `/opt/qwen-prompt-server/.env` outside Git.

## Required Runtime Services

- Gateway: `0.0.0.0:8001`
- vLLM OpenAI-compatible server: `127.0.0.1:8000`

## Minimal Gateway Run

```bash
cd /opt/qwen-prompt-server
python3 -m venv .venv-gateway
source .venv-gateway/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.gateway.txt
uvicorn app:app --host "${QWEN_SERVER_HOST:-0.0.0.0}" --port "${QWEN_SERVER_PORT:-8001}"
```

`/v1/prompts/refine` returns success only after an actual vLLM call and Pydantic validation. If vLLM or the model is not ready, it returns a standard failure JSON instead of a fake prompt.
