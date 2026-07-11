# Result: qwen-prompt-server-gateway-vllm

- protocol: codex-coop.v1
- task_id: qwen-prompt-server-gateway-vllm
- server_id: camp-11-root
- finished_at: 2026-07-11T06:43:31Z
- status: partial
- work_branch: work/camp-11-root/qwen-prompt-server-gateway-vllm
- commit: c604e0df15b0104ce67e674f13012bfd4e2d7f81
- review_requested: true

## Summary

Implemented the Qwen Prompt Gateway source, deployment files, validation scripts, and systemd unit files.
Deployed the source to `/opt/qwen-prompt-server`, installed the Gateway venv, prepared a vLLM venv entrypoint, and registered systemd units.
The API correctly avoids fake success: with no local vLLM/model loaded, `/v1/prompts/refine` returns `503 VLLM_UNAVAILABLE`.

## Changed Files

- `.gitignore`
- `qwen-prompt-server/**`
- `/opt/qwen-prompt-server` runtime deployment
- `/etc/systemd/system/qwen-vllm.service`
- `/etc/systemd/system/qwen-gateway.service`

## Verification

```bash
git status --short --branch
nvidia-smi
python3 --version
python3 -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
ss -ltnp
python -m compileall qwen-prompt-server
QWEN_API_TOKEN=test-token VLLM_API_KEY=test-vllm-key python -m uvicorn app:app --host 127.0.0.1 --port 8001
curl -i http://127.0.0.1:8001/health
curl -i http://127.0.0.1:8001/v1/model
curl -i -X POST http://127.0.0.1:8001/v1/prompts/refine -H "X-Internal-Token: test-token" ...
/opt/qwen-prompt-server/.venv-gateway/bin/python -m compileall /opt/qwen-prompt-server
systemctl status qwen-vllm qwen-gateway --no-pager
```

Results:

- `python -m compileall qwen-prompt-server`: pass
- GPU check: pass, RTX 3090 visible and CUDA available
- `GET /health`: pass, HTTP 200 with `vllm_ok=false` and `model_loaded=false`
- `GET /v1/model` without token: pass, HTTP 401 JSON with `UNAUTHORIZED`
- `POST /v1/prompts/refine` with a real temporary PNG while vLLM is down: pass, HTTP 503 JSON with `VLLM_UNAVAILABLE`
- `POST /v1/prompts/refine` with a non-image file: pass, HTTP 400 JSON with `INVALID_IMAGE_TYPE`
- `/opt/qwen-prompt-server` direct Gateway run: pass for the same health/auth/refine-unavailable checks
- `qwen-vllm.service` and `qwen-gateway.service`: loaded but intentionally inactive

## Risks

- GitHub push failed for `codex/communication` and the work branch: `fatal: could not read Username for 'https://github.com': No such device or address`.
- The GitHub app write attempt also failed with 403, so all commits currently exist only locally on this VM.
- `/models/Qwen2-VL-7B-Instruct` is missing, and `/models` does not exist.
- `172.10.5.138` is not assigned to this VM; current VM IP is `192.168.0.170`.
- Real `QWEN_API_TOKEN`, `VLLM_API_KEY`, backend server IP, and final model path are still required.
- Services were not started/enabled because the real `.env` and model are not ready. Starting them with placeholder values would create a misleading failure state.
- Successful `/v1/prompts/refine` with HTTP 200 was not run because it requires a loaded Qwen2-VL model and a real backend Job/user/image.

## Next Suggested Tasks

- `qwen-runtime-secrets-and-model`: place the real `.env`, provide or download Qwen2-VL 7B under the configured model path, then start `qwen-vllm` and `qwen-gateway`.
- `qwen-network-routing`: resolve whether backend should call `172.10.5.138:8001` or this VM's current `192.168.0.170:8001`, then apply firewall allow rules for the backend IP.
- `git-credential-setup`: configure GitHub credentials or grant the GitHub app write access, then push `codex/communication` and `work/camp-11-root/qwen-prompt-server-gateway-vllm`.
