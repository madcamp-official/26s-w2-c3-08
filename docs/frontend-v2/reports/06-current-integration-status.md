# 06 Current Integration Status

Date: 2026-07-14

Scope: post-remediation status snapshot for the committed Frontend V2 branch. This report records the integration evidence after `socket.io-client@4.8.3` was approved and added to the `client` workspace.

## Current Runtime Direction

- `client/ui-v2.html` remains the independent V2 entry while legacy root stays runnable.
- `npm run dev:v2` now starts the Express `backend` and Vite client with `VITE_DATA_MODE=remote` and `VITE_REALTIME_MODE=remote` by default.
- `client/vite.config.ts` proxies both `/api` and `/socket.io` to `VITE_API_PROXY_TARGET`.
- Remote realtime uses the backend Socket.IO contract through `socket.io-client@4.8.3`.
- BroadcastChannel remains allowed only for explicit `VITE_REALTIME_MODE=local` development/testing paths.
- Remote data/realtime failures must surface typed errors or offline/reconnecting states; they must not silently switch to mock data or local realtime.
- `backend/` is the V2 production-facing REST and Socket.IO authority. `server/`/Colyseus remains a supporting experiment workspace for alternate transport and AI/API validation.
- GPU asset workers now poll the backend authority through `/api/ai/jobs/next` and complete jobs through `/api/ai/jobs/:jobId/result`.
- Worker authentication uses `WORKER_TOKEN`; development/test can use `dev-worker-token`, but production must provide an explicit secret.
- GPU worker generation mode defaults to Qwen prompt refinement followed by WAN sprite generation. A single internal generation gateway remains available only through explicit `GPU_WORKER_GENERATION_MODE=gateway`.
- Generated image data URLs can be materialized into a shared local/static directory through `IMAGE_STORAGE_DIR`, `IMAGE_PUBLIC_PATH`, and `IMAGE_PUBLIC_BASE_URL`.

## Evidence Collected

| Command | Result |
| --- | --- |
| `npm run test:remote-v2-browser --workspace client` | PASS |
| `npm run realtime:check --workspace client` | PASS |
| `npm run lobby-room:check --workspace client` | PASS |
| `npm run game:check --workspace client` | PASS |
| `npm run flow:check --workspace client` | PASS |
| `npm run test --prefix backend` | PASS |
| `npm run typecheck --prefix backend` | PASS |
| `npm run check:v2` | PASS |
| `npm run check --prefix gpu-worker` | PASS |
| `npm run test:lobby-room --workspace client` | PASS |
| `npm run test:launcher-screenshots --workspace client` | PASS, 165 evidence screenshots |
| `npm run test:accessibility --workspace client` | PASS |
| `npm run test:studio-game-screenshots --workspace client` | PASS, 114 evidence screenshots |
| `npm run test:drawing-browser --workspace client` | PASS |

Notes:

- Vite still reports the known `assetRules` chunk-size warning; it does not fail the build.
- The remote browser test can log transient Vite `/socket.io` proxy `ECONNRESET` messages while Playwright closes browser contexts; the test completed successfully.
- Remote race completion now has a bounded same-remote-endpoint result poll after the first finisher, so a page that does not receive the final Socket.IO event still reaches the authoritative results screen without falling back to mock/local data.
- Backend asset generation now has a worker claim/result contract, Socket.IO asset job update broadcast, a GPU worker Qwen/WAN generation path, and a shared-directory image materialization path covered by contract self-tests. The final production credentials and storage values are still deferred.

## Updated Blocker Status

| Previous blocker | Current status | Evidence |
| --- | --- | --- |
| BLK-001 `main:check` stale Lobby placeholder assertion | Resolved in current worktree | `npm run main:check --workspace client` via `npm run check:v2` |
| BLK-002 `shells:check` contract mismatch | Resolved in current worktree | `npm run shells:check --workspace client` via `npm run check:v2` |
| BLK-005 Game production phase path | Substantially remediated | `game:check`, `flow:check`, remote browser Login to Results |
| BLK-006 Game lifecycle/phase E2E | Partially remediated | remote browser Login to Results passes; route leave/return and resize-specific proof still need targeted coverage |
| BLK-007 Socket.IO remote runtime | Resolved for current backend/client path | `socket.io-client@4.8.3`, `realtime:check`, remote browser Login to Results |
| BLK-008 Playwright environment | Resolved in this local environment for launcher/lobby/remote/drawing suites | launcher, lobby-room, remote-v2, and drawing browser Playwright PASS |
| BLK-009 Full Login to Results E2E | Resolved for remote/remote path | `client/tests/remote-v2/remote-lobby-room.spec.ts` |
| BLK-010 Visual screenshot coverage | Resolved for Launcher/Studio/Game State Gallery evidence | 165 Launcher screenshots and 114 Studio/Game screenshots pass |
| BLK-011 Accessibility browser gates | Partially remediated | modal focus trap/restore, icon-only names, live regions, and Game canvas focus boundary pass in `test:accessibility`; full accessibility audit still needs broader screen coverage |
| AI worker job contract | Resolved for backend/gpu-worker HTTP, Socket.IO update, Qwen/WAN request, and local image materialization contract | `/api/ai/jobs/next`, `/api/ai/jobs/:jobId/result`, `asset_job:updated`, backend contract test, gpu-worker self-test |

## Remaining Pre-Switch Risks

- Visual evidence now covers Launcher, Studio, and Game State Gallery matrices at 1280x720, 1440x900, and 1920x1080. Golden/baseline approval is still a separate product review step.
- Accessibility now has browser-level modal, icon label, live region, and Game canvas focus-boundary coverage. Broader keyboard-only flow and Studio/Game screen coverage still need expansion before default V2 switch.
- Drawing browser acceptance now passes locally with the Playwright Chromium harness. CI/pinned-environment confirmation is still required before changing `drawing-engine-adr` to ACCEPTED.
- `madcamp2.pdf` is intentionally kept outside commits through local Git exclude. It remains a source artifact for implementation reference, not a repository deliverable.
- Production AI asset generation still needs final Qwen/WAN credentials and deployment environment values. Shared-directory image storage is wired for local/shared-volume deployment; object storage credentials and URLs remain a deployment decision.
- Current Warehouse remote updates use Socket.IO when available and bounded `/api/asset-jobs` polling for asset jobs.

## Next Recommended Work

1. Expand browser accessibility coverage to full keyboard-only Launcher/Studio/Game flows.
2. Confirm drawing browser acceptance in CI/pinned environment and then update `drawing-engine-adr` status if it passes there.
3. Add deployment documentation for the `backend/` production authority and required AI/storage environment variables before default entry switch.
4. Review and approve visual evidence before creating or updating golden baselines.
