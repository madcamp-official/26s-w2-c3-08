# Qwen runtime deployment status

- From: camp-11-root / qwen-runtime
- Time: 2026-07-11T07:33:47Z
- Related task: qwen-prompt-server-gateway-vllm
- Work branch: `origin/work/camp-11-root/qwen-prompt-server-gateway-vllm`
- Latest implementation commit: `73a096a` (`fix: disable flashinfer sampler by default`)

## Summary

Qwen runtime is now deployed under `/opt/qwen-prompt-server`.

FastAPI Gateway and local vLLM are both running:

- `qwen-vllm.service`: active
- `qwen-gateway.service`: active
- vLLM bind: `127.0.0.1:8000`
- Gateway bind: `0.0.0.0:8001`

The Qwen2-VL model is present at:

- `/models/Qwen2-VL-7B-Instruct`
- size: `16G`
- served model id: `qwen2-vl-7b-instruct`

## Actual Gateway IP

`ip -brief addr` shows:

```text
lo               UNKNOWN        127.0.0.1/8 ::1/128
ens3             UP             192.168.0.170/24 metric 100 fe80::f816:3eff:fe25:4738/64
```

This VM does not have `172.10.5.138` assigned. Backend should use:

```text
QWEN_BASE_URL=http://192.168.0.170:8001
```

If backend must keep using `172.10.5.138`, network/IP mapping to this VM still needs to be configured outside the app.

## Env / Secrets

`/opt/qwen-prompt-server/.env` is prepared with real local values. Secret values are intentionally not written here.

Important: `QWEN_API_TOKEN` was generated and stored only in `/opt/qwen-prompt-server/.env`. Backend must be configured with the same token through a secret channel before authenticated calls can succeed from backend.

`VLLM_USE_FLASHINFER_SAMPLER=0` was added because vLLM 0.24 selected FlashInfer top-p/top-k sampler by default, and this server does not have `nvcc`. Without this, vLLM crashed during initialization with:

```text
RuntimeError: Could not find nvcc and default cuda_home='/usr/local/cuda' doesn't exist
```

## Listening Ports

`ss -lntp | grep -E '8000|8001'`:

```text
LISTEN 0 2048 127.0.0.1:8000 0.0.0.0:* users:(("vllm",pid=19672,fd=27))
LISTEN 0 2048 0.0.0.0:8001   0.0.0.0:* users:(("uvicorn",pid=20198,fd=6))
```

## Verification

`curl -i http://127.0.0.1:8000/v1/models` returned HTTP 200 and model `qwen2-vl-7b-instruct`.

`curl -i http://127.0.0.1:8001/health` returned HTTP 200:

```json
{
  "ok": true,
  "gateway_ok": true,
  "vllm_ok": true,
  "model_loaded": true,
  "engine": "vllm",
  "model": "qwen2-vl-7b-instruct",
  "model_path": "/models/Qwen2-VL-7B-Instruct",
  "model_path_exists": true,
  "token_configured": true
}
```

`curl -i http://127.0.0.1:8001/v1/model -H "X-Internal-Token: <redacted>"` returned HTTP 200:

```json
{
  "ok": true,
  "model_id": "qwen2-vl-7b-instruct",
  "model_path": "/models/Qwen2-VL-7B-Instruct",
  "engine": "vllm",
  "engine_url": "http://127.0.0.1:8000/v1",
  "vllm_ok": true,
  "model_loaded": true
}
```

`curl -i http://127.0.0.1:8001/v1/model` without token returned HTTP 401 with `UNAUTHORIZED`.

`curl -i http://192.168.0.170:8001/health` also returned HTTP 200.

A short direct vLLM generation probe returned HTTP 200 and generated `ok`, confirming the sampler crash is resolved.

`python3 -m compileall qwen-prompt-server` passed.

## Refine Verification

`POST /v1/prompts/refine` with a real backend job was not run yet.

Reason: the required real values are not present on this runtime shell:

- `REAL_REQUEST_ID`: missing
- `REAL_USER_ID`: missing
- `REAL_USER_PROMPT`: missing
- `REAL_IMAGE_PATH`: missing

No fake or dummy refine success was created.

## Firewall / Network Blocker

`ufw status numbered`:

```text
Status: inactive
```

The backend server IP is not available in this shell (`REAL_BACKEND_SERVER_IP` is missing), so I did not add a guessed firewall allow rule.

Remaining network work:

- provide the real backend server IP
- allow only that backend IP to reach TCP `8001`
- keep vLLM `8000` bound to localhost only
- either update backend to `http://192.168.0.170:8001` or map `172.10.5.138` to this VM

## Remaining Action Items

1. Share the runtime `QWEN_API_TOKEN` with backend through a secret channel and set backend `QWEN_API_TOKEN` to the same value.
2. Set backend `QWEN_BASE_URL=http://192.168.0.170:8001`, unless the network team maps `172.10.5.138` to this VM.
3. Provide real backend job values and uploaded image path, then run `/opt/qwen-prompt-server/scripts/verify_refine_with_real_job.sh`.
4. Apply firewall rules once the real backend IP is known.
