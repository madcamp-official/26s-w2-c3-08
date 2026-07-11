# Message

- protocol: codex-coop.v1
- from: camp-53-tjwls8912
- to: qwen-runtime
- created_at: 2026-07-11T07:57:26Z
- related_task: backend-qwen-gateway-integration
- urgency: normal
- requires_response: true

## Summary

Backend Qwen Gateway integration was implemented and pushed.

Please verify that the Qwen runtime contract still matches the backend client expectations, and report any schema or endpoint mismatch before refine is tested with a real job.

## Backend Branch

- Branch: `work/camp-53-tjwls8912/backend-qwen-gateway-integration`
- Commit: `c58243febc64ee7d4f0eb9f47c39521c895ccc61`
- Communication branch pushed through: `4166278`

## Backend Expectations

The backend now calls:

- `GET /health` without token
- `GET /v1/model` with `X-Internal-Token: $QWEN_API_TOKEN`
- `POST /v1/prompts/refine` with `multipart/form-data` and `X-Internal-Token: $QWEN_API_TOKEN`

Refine form fields expected by backend:

- `request_id`: real backend job id
- `user_id`: real backend user id
- `target_type`: `avatar` or `asset`
- `user_prompt`: real user prompt, 1 to 500 chars
- `locale`: `ko-KR`
- `style_preset`: `platformer_sprite`
- `output_language`: `en`
- `asset_type`: required only when `target_type=asset`; one of `DEVICE`, `TERRAIN`, `ENEMY`, `ITEM`, `BACKGROUND`
- `image`: real uploaded PNG/JPEG/WEBP file bytes

Successful refine response must satisfy:

- `ok === true`
- `request_id` exactly matches the submitted backend job id
- `schema_version`
- `model`
- `engine`
- `target_type`
- `visual_summary_ko`
- `user_intent_ko`
- `wan_prompt`
- `wan_negative_prompt`
- `sprite_requirements`
- `safety_flags`
- `warnings`
- `confidence`
- `latency_ms`

Failure response expected by backend:

- `ok === false`
- `request_id` or `null`
- `error.code`
- `error.message`

## Requested Qwen Runtime Actions

1. Pull the latest communication branch and inspect this message:

```bash
cd /home/26s-w2-c3-08
git fetch origin
git switch codex/communication
git pull --rebase origin codex/communication
```

2. Fetch and inspect the backend work branch contract:

```bash
git fetch origin work/camp-53-tjwls8912/backend-qwen-gateway-integration
git show origin/work/camp-53-tjwls8912/backend-qwen-gateway-integration:server/src/qwen/qwenSchemas.ts
git show origin/work/camp-53-tjwls8912/backend-qwen-gateway-integration:server/src/qwen/qwenClient.ts
git show origin/work/camp-53-tjwls8912/backend-qwen-gateway-integration:server/src/qwen/qwenRefineWorker.ts
```

3. Verify Qwen runtime status locally on the Qwen VM:

```bash
curl -i http://127.0.0.1:8001/health
curl -i http://127.0.0.1:8001/v1/model
curl -i http://127.0.0.1:8001/v1/model -H "X-Internal-Token: $QWEN_API_TOKEN"
```

Expected:

- `/health`: HTTP 200 and `ok=true`, `vllm_ok=true`, `model_loaded=true`
- `/v1/model` without token: HTTP 401
- `/v1/model` with real token: HTTP 200

4. Do not run refine with synthetic values. Only run refine when real values are present:

- real backend job id
- real user id
- real user prompt
- real uploaded image file
- real Qwen token

5. If refine is run and fails, report exact HTTP status and response body. Do not convert 503, 422, 500, timeout, or invalid model output into success.

6. If the runtime response schema differs from backend expectations, report the mismatch in a new `.codex-coop/messages/*--from-qwen-runtime--to-all.md` file and do not silently change the contract.

## Backend Retry Handling

The backend worker now treats Qwen results as:

- HTTP 200 plus schema-valid body: `succeeded`
- HTTP 400, 401, 413: `failed`
- HTTP 422: one immediate retry, then `failed`
- HTTP 429: `pending_retry`
- HTTP 500: one immediate retry, then `failed`
- HTTP 503 or network timeout: `pending_retry`

## Security Notes

- Do not write `QWEN_API_TOKEN` into git.
- Do not print token values in result files.
- Keep vLLM bound to localhost only.
- Gateway should remain the only externally reachable Qwen HTTP service.
