# Result: qwen-model-degraded-state-backend

- protocol: codex-coop.v1
- task_id: backend-qwen-gateway-integration
- server_id: camp-53-tjwls8912
- finished_at: 2026-07-11T08:08:32Z
- status: succeeded
- work_branch: work/camp-53-tjwls8912/backend-qwen-gateway-integration
- commit: 160a89f2223afed42160b8048b868b72788dff39
- review_requested: true

## Summary

Applied the Qwen runtime contract follow-up from `.codex-coop/messages/20260711T080106Z--from-qwen-runtime--to-all.md`.
The backend now parses degraded HTTP 200 `/v1/model` bodies and maps non-ready model state to a `503` `QwenClientError`, so existing retry policy returns `pending_retry` instead of treating the response as schema-invalid.

## Changed Files

- `server/src/qwen/qwenSchemas.ts`
- `server/src/qwen/qwenClient.ts`
- `server/test/qwenModel.test.ts`

## Behavior

- Healthy `/v1/model` responses with `ok=true`, `vllm_ok=true`, and `model_loaded=true` still return successfully.
- Degraded `/v1/model` responses with HTTP 200 but `ok=false`, `vllm_ok=false`, or `model_loaded=false` now throw:
  - status: `503`
  - code: `vllm_error_code` if provided, otherwise `MODEL_NOT_READY`
  - message: `Qwen model is not ready`
- Because status `503` is already mapped to `pending_retry`, backend callers can keep the job pending instead of failing with `QWEN_MODEL_RESPONSE_INVALID`.
- `/health` behavior was not changed.
- `/v1/prompts/refine` contract and success/failure schemas were not changed.

## Verification

Executed:

```bash
git diff --check -- server/src/qwen/qwenSchemas.ts server/src/qwen/qwenClient.ts server/test/qwenModel.test.ts
bash -n server/scripts/verify-qwen-health.sh server/scripts/verify-qwen-model.sh server/scripts/verify-qwen-refine.sh
curl -i --connect-timeout 5 --max-time 10 http://192.168.0.170:8001/health
curl -i --connect-timeout 5 --max-time 10 http://192.168.0.170:8001/v1/model
npm --workspace server run build
npm --workspace server test
```

Results:

- `git diff --check`: pass
- verification script shell syntax: pass
- Qwen health: HTTP 200, `ok=true`, `vllm_ok=true`, `model_loaded=true`, model `qwen2-vl-7b-instruct`
- Qwen `/v1/model` without token: HTTP 401 with `UNAUTHORIZED`, as expected
- `npm --workspace server run build`: not run successfully; this shell has no `npm`
- `npm --workspace server test`: not run successfully; this shell has no `npm`

Not run:

- Qwen `/v1/model` with token: `QWEN_API_TOKEN` is not present in this shell
- Qwen refine verification: real backend job id, real user id, real user prompt, real uploaded image, and `QWEN_API_TOKEN` are not present

## Security

- No `QWEN_API_TOKEN` value was printed or committed.
- No synthetic refine success was created.
- No mock, dummy, or fake WAN prompt was added.

## Remaining Blockers

- Run `npm --workspace server run build` and `npm --workspace server test` on a Node/npm-capable backend environment.
- Set `QWEN_API_TOKEN` through a secret channel and run authenticated `/v1/model` verification.
- Run refine verification only after real backend job/user/prompt/image values exist.
