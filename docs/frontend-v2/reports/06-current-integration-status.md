# 06 Current Integration Status

Date: 2026-07-14

Scope: post-remediation status snapshot for the committed Frontend V2 branch. This report records the integration evidence after `socket.io-client@4.8.3` was approved and added to the `client` workspace.

## Current Runtime Direction

- `client/ui-v2.html` remains the independent V2 entry while legacy root stays runnable.
- `npm run dev:v2` now starts the Express `backend` and Vite client with `VITE_DATA_MODE=remote` and `VITE_REALTIME_MODE=remote` by default.
- `client/vite.config.ts` proxies both `/api` and `/socket.io` to `VITE_API_PROXY_TARGET`.
- V2 remote session restore validates persisted tokens through backend `/api/session/validate`; invalid tokens clear the V2 session instead of falling back to mock.
- Remote realtime uses the backend Socket.IO contract through `socket.io-client@4.8.3`.
- Socket.IO `room:ready` and `phase:ready` now persist readiness into the backend API room snapshot, so REST refetch/reconnect observes the same ready state.
- Socket.IO phase advances and applied time-vote timer deltas now persist the same `phaseEndsAt` into the backend API room snapshot, so REST refetch/reconnect observes the same timer metadata.
- Socket.IO and REST race progress now persist monotonic best player progress into the backend API race snapshot, while Phaser remains the owner of local render/input/physics.
- Socket.IO race finish now uses the same backend helper as REST finish, so duplicate finish events keep the canonical minimum finish time and final results come from API race state.
- BroadcastChannel remains allowed only for explicit `VITE_REALTIME_MODE=local` development/testing paths.
- Remote data/realtime failures must surface typed errors or offline/reconnecting states; they must not silently switch to mock data or local realtime.
- Backend HTTP and Socket.IO now share the same comma-separated `CORS_ORIGIN` parser for single-origin and multi-origin deployments.
- Backend `/health` is a non-sensitive liveness endpoint, while `/ready` exposes sanitized readiness booleans/counts and returns `503` when production backend-required secrets are missing.
- Backend-internal Qwen proxy routes under `/internal/qwen/*` require `INTERNAL_API_TOKEN` in production and accept `X-Backend-Internal-Token` or bearer auth.
- `backend/` is the V2 production-facing REST and Socket.IO authority. `server/`/Colyseus remains a supporting experiment workspace for alternate transport and AI/API validation.
- User-generated `item` assets are rejected by `/api/assets/generate` with `ASSET_CATEGORY_NOT_ALLOWED`; backend system item seeds remain available for gameplay placement.
- Avatar generation primary path `/api/assets/avatar/generate` is implemented for FormData/JSON and rejects non-avatar categories with `ASSET_CATEGORY_MISMATCH`; `/api/assets/generate` remains the generic compatibility endpoint.
- GPU asset workers now poll the backend authority through `/api/ai/jobs/next` and complete jobs through `/api/ai/jobs/:jobId/result`.
- Worker authentication uses `WORKER_TOKEN`; development/test can use `dev-worker-token`, but production must provide an explicit secret.
- Worker completion now requires the active `x-worker-id` lease. Expired leases are recovered before claim/list refresh, and stale worker completions return typed `409` errors instead of overwriting a re-claimed job.
- Asset job status is available through `/api/assets/generation-jobs/:jobId` for direct job snapshots and `/api/asset-jobs?user_id=<id>` for session-wide bounded polling.
- GPU worker generation mode defaults to Qwen prompt refinement followed by WAN sprite generation. A single internal generation gateway remains available only through explicit `GPU_WORKER_GENERATION_MODE=gateway`.
- Generated image data URLs can be materialized through `IMAGE_STORAGE_MODE=local` shared static storage or `IMAGE_STORAGE_MODE=http-put` object-storage gateway upload.
- Production readiness for client/backend/gpu-worker environment values is checked by `npm run check:production-env`; `npm run check:v2` runs the checker self-test without requiring real secrets.
- `.github/workflows/frontend-v2-browser-gates.yml` now passes pinned Playwright CI jobs for the aggregate V2 check and browser evidence suites.

## Evidence Collected

| Command | Result |
| --- | --- |
| `npm run test:remote-v2-browser --workspace client` | PASS, includes route leave/return and Phaser bridge resize/remount proof |
| `npm run realtime:check --workspace client` | PASS |
| `npm run lobby-room:check --workspace client` | PASS |
| `npm run game:check --workspace client` | PASS |
| `npm run flow:check --workspace client` | PASS, includes remote session create/validate and Login-to-Results adapter flow |
| `npm run test --prefix backend` | PASS, includes remote nickname update, sprite regeneration, avatar-specific FormData generation, category mismatch rejection, user-generated item rejection, system item seed preservation, direct asset job status, worker lease rollover, stale result rejection, monotonic race progress snapshot sync, REST/realtime race finish min-time idempotency, and realtime timer persistence |
| `npm run typecheck --prefix backend` | PASS |
| `npm run check:v2` | PASS |
| `npm run check --prefix gpu-worker` | PASS |
| `npm run test:lobby-room --workspace client` | PASS |
| `npm run test:launcher-screenshots --workspace client` | PASS, 165 evidence screenshots |
| `npm run test:accessibility --workspace client` | PASS, 103 browser accessibility tests covering modal focus, representative keyboard traversal, and every State Gallery fixture for structural accessibility |
| `npm run test:studio-game-screenshots --workspace client` | PASS, 114 evidence screenshots |
| `npm run test:drawing-browser --workspace client` | PASS |
| `npm run check:production-env:self-test` | PASS |
| `.github/workflows/drawing-engine-browser.yml` | PASS on GitHub Actions run `29349726560` |
| `.github/workflows/frontend-v2-browser-gates.yml` | PASS on GitHub Actions latest workflow-covered run `29351187605` for commit `31976e0`, including `V2 Aggregate Check` and `V2 Browser Evidence` |

Notes:

- Vite still reports the known `assetRules` chunk-size warning; it does not fail the build.
- The remote browser test can log transient Vite `/socket.io` proxy `ECONNRESET` messages while Playwright closes browser contexts; the test completed successfully.
- Remote race completion now has a bounded same-remote-endpoint result poll after the first finisher, so a page that does not receive the final Socket.IO event still reaches the authoritative results screen without falling back to mock/local data.
- Remote browser E2E now proves Game route leave/return cleanup and Phaser bridge resize stability for Map Build, Validation, and Race without changing Phaser gameplay behavior.
- Backend asset generation now has avatar-specific FormData/JSON generation, generic asset FormData/JSON generation, direct asset job status lookup, a worker claim/result contract, active worker-id lease validation, expired lease recovery, Socket.IO asset job update broadcast, a GPU worker Qwen/WAN generation path, and generated image materialization through local shared storage or HTTP PUT object-storage gateway upload covered by contract self-tests. The final production credentials and storage values are still deferred.
- Production env readiness now fails closed on missing/placeholder credentials, missing backend `INTERNAL_API_TOKEN`, localhost public URLs, backend/gpu-worker worker token mismatch, and `GPU_WORKER_SIMULATE=true`.
- Production env readiness accepts comma-separated public `CORS_ORIGIN` values and validates each origin independently.
- CI passes `check:v2`, browser environment check, remote V2 flow, lobby/room, accessibility, and Launcher/Studio/Game visual evidence in the `mcr.microsoft.com/playwright:v1.61.1-noble` container.

## Updated Blocker Status

| Previous blocker | Current status | Evidence |
| --- | --- | --- |
| BLK-001 `main:check` stale Lobby placeholder assertion | Resolved in current worktree | `npm run main:check --workspace client` via `npm run check:v2` |
| BLK-002 `shells:check` contract mismatch | Resolved in current worktree | `npm run shells:check --workspace client` via `npm run check:v2` |
| BLK-005 Game production phase path | Substantially remediated | `game:check`, `flow:check`, remote browser Login to Results |
| BLK-006 Game lifecycle/phase E2E | Resolved for current remote browser gate | `test:remote-v2-browser` covers Login to Results, Game route leave/return, and Phaser bridge resize/remount evidence |
| BLK-007 Socket.IO remote runtime | Resolved for current backend/client path | `socket.io-client@4.8.3`, `realtime:check`, remote browser Login to Results |
| BLK-008 Playwright environment | Resolved in this local environment for launcher/lobby/remote/drawing suites | launcher, lobby-room, remote-v2, and drawing browser Playwright PASS |
| BLK-009 Full Login to Results E2E | Resolved for remote/remote path | `client/tests/remote-v2/remote-lobby-room.spec.ts` |
| BLK-010 Visual screenshot coverage | Resolved for Launcher/Studio/Game State Gallery evidence | 165 Launcher screenshots and 114 Studio/Game screenshots pass |
| BLK-011 Accessibility browser gates | Resolved for current browser gate | modal focus trap/restore, icon-only names, live regions, Game canvas focus boundary, representative Launcher/Studio/Game keyboard traversal, and every State Gallery fixture structural accessibility pass in `test:accessibility` |
| AI worker job contract | Resolved for backend/gpu-worker HTTP, direct job status lookup, worker lease rollover, Socket.IO update, Qwen/WAN request, local image materialization, and HTTP PUT upload contract | `/api/assets/generation-jobs/:jobId`, `/api/ai/jobs/next`, `/api/ai/jobs/:jobId/result`, `asset_job:updated`, backend contract test, gpu-worker self-test |

## Remaining Pre-Switch Risks

- Visual evidence now covers Launcher, Studio, and Game State Gallery matrices at 1280x720, 1440x900, and 1920x1080. Golden/baseline approval is still a separate product review step.
- Accessibility now has browser-level modal, icon label, live region, Game canvas focus-boundary, representative Launcher/Studio/Game keyboard traversal, and every State Gallery fixture structural coverage. A third-party axe scan remains optional hardening, not a current browser-gate blocker.
- Drawing browser acceptance now passes locally and in pinned GitHub Actions; `drawing-engine-adr` is ACCEPTED.
- `madcamp2.pdf` is intentionally kept outside commits through local Git exclude. It remains a source artifact for implementation reference, not a repository deliverable.
- Production AI asset generation still needs final Qwen/WAN credentials and deployment environment values. Generated image storage can use local/shared-volume deployment or an HTTP PUT object-storage gateway; actual storage credentials and URLs remain deployment inputs.
- Production env values should be prepared from `client/.env.example`, `backend/.env.example`, and `gpu-worker/.env.example`, then checked with `npm run check:production-env -- --client-env-file client/.env.production --backend-env-file backend/.env.production --gpu-worker-env-file gpu-worker/.env.production` before any default V2 entry switch. The handoff checklist is `docs/frontend-v2/reports/07-production-handoff-checklist.md`.
- Current Warehouse remote updates use Socket.IO when available and bounded `/api/asset-jobs` polling for session-wide asset jobs; `/api/assets/generation-jobs/:jobId` is available for direct job snapshots when a controller tracks a specific job id.

## Next Recommended Work

1. Run `npm run check:production-env` with the final deployment env files once Qwen/WAN credentials, worker token, client origin, and storage URLs are available.
2. Review and approve visual evidence before creating or updating golden baselines.
3. Decide whether a third-party axe scan should be added as post-switch accessibility hardening.
