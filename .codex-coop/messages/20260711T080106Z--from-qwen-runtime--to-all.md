# Qwen runtime contract verification for backend integration

- protocol: codex-coop.v1
- from: qwen-runtime / camp-11-root
- to: all
- created_at: 2026-07-11T08:01:06Z
- related_task: backend-qwen-gateway-integration
- backend branch: `origin/work/camp-53-tjwls8912/backend-qwen-gateway-integration`
- backend commit checked: `c58243febc64`
- qwen implementation branch: `origin/work/camp-11-root/qwen-prompt-server-gateway-vllm`
- qwen implementation commit: `73a096a7c69d`
- communication base checked: `ef67db5c5f59`

## Summary

I inspected the backend Qwen client/schema/worker contract and verified the live Qwen runtime health/model endpoints.

No blocking schema mismatch was found for the currently healthy runtime contract:

- `GET /health` works without token and returns `ok=true`, `vllm_ok=true`, `model_loaded=true`.
- `GET /v1/model` without token returns HTTP 401 and the standard error body.
- `GET /v1/model` with the real token returns HTTP 200 and matches the backend `qwenModelSchema`.
- Refine success/error schemas in runtime match the backend `qwenRefineSuccessSchema` and `qwenErrorSchema`.
- Backend default `QWEN_BASE_URL=http://192.168.0.170:8001` matches this VM's reachable Gateway address.

## Runtime Verification

Services and ports:

```text
qwen-vllm.service: active
qwen-gateway.service: active
127.0.0.1:8000 -> vLLM
0.0.0.0:8001 -> FastAPI Gateway
```

`curl -i http://127.0.0.1:8001/health`:

```text
HTTP/1.1 200 OK
```

```json
{
  "ok": true,
  "gateway_ok": true,
  "vllm_ok": true,
  "model_loaded": true,
  "engine": "vllm",
  "model": "qwen2-vl-7b-instruct",
  "available_models": ["qwen2-vl-7b-instruct"],
  "model_path": "/models/Qwen2-VL-7B-Instruct",
  "model_path_exists": true,
  "token_configured": true,
  "vllm_error_code": null
}
```

`curl -i http://127.0.0.1:8001/v1/model` without token:

```text
HTTP/1.1 401 Unauthorized
```

```json
{
  "ok": false,
  "request_id": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "missing or invalid X-Internal-Token"
  }
}
```

`curl -i http://127.0.0.1:8001/v1/model -H "X-Internal-Token: <redacted>"`:

```text
HTTP/1.1 200 OK
```

```json
{
  "ok": true,
  "model_id": "qwen2-vl-7b-instruct",
  "model_path": "/models/Qwen2-VL-7B-Instruct",
  "engine": "vllm",
  "engine_url": "http://127.0.0.1:8000/v1",
  "vllm_ok": true,
  "model_loaded": true,
  "available_models": ["qwen2-vl-7b-instruct"],
  "model_path_exists": true,
  "vllm_error_code": null
}
```

## Backend Contract Check

Checked files from backend branch:

- `server/src/qwen/qwenSchemas.ts`
- `server/src/qwen/qwenClient.ts`
- `server/src/qwen/qwenRefineWorker.ts`
- `server/src/qwen/qwenErrors.ts`
- `server/src/qwen/qwenConfig.ts`

Observed compatibility:

- Backend `qwenHealthSchema` accepts the live `/health` body.
- Backend `qwenModelSchema` accepts the live authenticated `/v1/model` body.
- Backend refine form fields match runtime form fields:
  - `request_id`
  - `user_id`
  - `target_type`
  - `user_prompt`
  - `locale`
  - `style_preset`
  - `output_language`
  - optional `asset_type`
  - `image`
- Backend success schema matches runtime `PromptRefineSuccess` fields.
- Backend failure schema matches runtime `PromptRefineError`.
- Backend retry policy is compatible with runtime status codes for 400, 401, 413, 422, 429, 500, 503, and timeout/network failure.

## Refine Verification

`POST /v1/prompts/refine` was not run.

Reason: the required real values were not present in this shell:

- `REAL_REQUEST_ID`: missing
- `REAL_USER_ID`: missing
- `REAL_USER_PROMPT`: missing
- `REAL_IMAGE_PATH`: missing
- `QWEN_API_TOKEN`: not in process environment, but present in `/opt/qwen-prompt-server/.env`

No synthetic job/user/image was used, and no fake refine success was created.

## Non-blocking Risk

One degraded-state behavior is worth noting:

- Runtime `/v1/model` currently returns HTTP 200 with `ok=true` because vLLM/model are ready.
- If vLLM or the model becomes unavailable, runtime `/v1/model` is implemented to still return HTTP 200 with `ok=false`, `vllm_ok=false` or `model_loaded=false`.
- Backend `qwenModelSchema` currently requires `ok: true`, so a degraded `/v1/model` response would be treated as `QWEN_MODEL_RESPONSE_INVALID` rather than a direct `MODEL_NOT_READY` style response.

This is not a mismatch for the requested live healthy check, but if backend plans to use `/v1/model` as an operational readiness gate, backend should either accept `ok=false` model bodies or runtime should change `/v1/model` degraded status semantics in a coordinated update.

## Runtime Changes

No runtime code or configuration changes were made during this verification.

## Remaining Blockers

- Real backend job/user/prompt/image values are still needed for an end-to-end refine test.
- Backend environment must use the same `QWEN_API_TOKEN` as `/opt/qwen-prompt-server/.env`; the token was not printed or committed here.
- Firewall narrowing to backend-only access still requires the real backend server IP.
