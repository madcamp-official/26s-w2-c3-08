# Qwen runtime verification after backend degraded-state update

- protocol: codex-coop.v1
- from: qwen-runtime / camp-11-root
- to: all
- created_at: 2026-07-11T08:13:41Z
- related_task: backend-qwen-gateway-integration
- backend branch: `origin/work/camp-53-tjwls8912/backend-qwen-gateway-integration`
- backend commit checked: `160a89f2223a`
- qwen implementation branch: `origin/work/camp-11-root/qwen-prompt-server-gateway-vllm`
- qwen implementation commit: `73a096a7c69d`
- communication base checked: `3b995b67463d`

## Summary

I verified the backend follow-up for degraded `/v1/model` handling against the live Qwen runtime contract.

Result: no blocking mismatch found.

- Backend now accepts `/v1/model` bodies with `ok: false`.
- Backend maps degraded HTTP 200 model readiness bodies to `QwenClientError` status `503`.
- Backend uses `vllm_error_code` when present, otherwise `MODEL_NOT_READY`.
- Backend message is exactly `Qwen model is not ready`.
- Backend retry policy maps 503 to `pending_retry`.
- `/v1/prompts/refine` request/response contract was not changed.
- Qwen runtime code/config was not changed during this verification.

## Backend Degraded-State Check

Checked files from backend branch:

- `server/src/qwen/qwenSchemas.ts`
- `server/src/qwen/qwenClient.ts`
- `server/test/qwenModel.test.ts`
- `server/src/qwen/qwenErrors.ts`
- `server/src/qwen/qwenRefineWorker.ts`

Observed implementation:

- `qwenModelSchema.ok` is `z.boolean()`, not `z.literal(true)`.
- `qwenModelSchema` includes `vllm_error_code: z.string().nullable().optional()`.
- `QwenClient.model()` parses the HTTP 200 body first, then checks readiness.
- If `ok !== true`, `vllm_ok !== true`, or `model_loaded !== true`, it throws:

```text
status: 503
code: parsed.data.vllm_error_code ?? "MODEL_NOT_READY"
message: "Qwen model is not ready"
```

- `getQwenRetryPolicy(503)` returns action `pending_retry`.
- `server/test/qwenModel.test.ts` includes coverage for parsing degraded model responses and mapping them to pending-retry client errors.

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

## Refine Verification

`POST /v1/prompts/refine` was not run.

Reason: the required real values are not present in this runtime shell:

- `REAL_REQUEST_ID`: missing
- `REAL_USER_ID`: missing
- `REAL_USER_PROMPT`: missing
- `REAL_IMAGE_PATH`: missing
- `QWEN_API_TOKEN`: not in process environment; present only in `/opt/qwen-prompt-server/.env`

No synthetic job/user/image was used, and no fake refine success was created.

## Schema Mismatch

No runtime/backend schema mismatch was found for:

- healthy `/health`
- unauthenticated `/v1/model` error body
- authenticated healthy `/v1/model`
- degraded HTTP 200 `/v1/model` handling in backend
- `/v1/prompts/refine` request fields and success/error schemas

## Runtime Changes

No Qwen runtime code or configuration changes were made.

## Remaining Blockers

- Real backend job/user/prompt/image values are still needed for an end-to-end refine test.
- Backend must use the same `QWEN_API_TOKEN` as `/opt/qwen-prompt-server/.env`; the token was not printed or committed here.
- Firewall narrowing to backend-only access still requires the real backend server IP.
