# 06 Current Integration Status

Date: 2026-07-14

Scope: post-remediation status snapshot for the current uncommitted Frontend V2 worktree. This report records the integration evidence after `socket.io-client@4.8.3` was approved and added to the `client` workspace.

## Current Runtime Direction

- `client/ui-v2.html` remains the independent V2 entry while legacy root stays runnable.
- `npm run dev:v2` now starts the Express `backend` and Vite client with `VITE_DATA_MODE=remote` and `VITE_REALTIME_MODE=remote` by default.
- `client/vite.config.ts` proxies both `/api` and `/socket.io` to `VITE_API_PROXY_TARGET`.
- Remote realtime uses the backend Socket.IO contract through `socket.io-client@4.8.3`.
- BroadcastChannel remains allowed only for explicit `VITE_REALTIME_MODE=local` development/testing paths.
- Remote data/realtime failures must surface typed errors or offline/reconnecting states; they must not silently switch to mock data or local realtime.

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
| `npm run test:lobby-room --workspace client` | PASS |
| `npm run test:launcher-screenshots --workspace client` | PASS, 165 evidence screenshots |
| `npm run test:accessibility --workspace client` | PASS |
| `npm run test:studio-game-screenshots --workspace client` | PASS, 114 evidence screenshots |
| `npm run test:drawing-browser --workspace client` | PASS |

Notes:

- Vite still reports the known `assetRules` chunk-size warning; it does not fail the build.
- The remote browser test logged a transient Vite `/socket.io` proxy `ECONNRESET` after the passing flow; the test completed successfully.

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

## Remaining Pre-Switch Risks

- Visual evidence now covers Launcher, Studio, and Game State Gallery matrices at 1280x720, 1440x900, and 1920x1080. Golden/baseline approval is still a separate product review step.
- Accessibility now has browser-level modal, icon label, live region, and Game canvas focus-boundary coverage. Broader keyboard-only flow and Studio/Game screen coverage still need expansion before default V2 switch.
- Drawing browser acceptance now passes locally with the Playwright Chromium harness. CI/pinned-environment confirmation is still required before changing `drawing-engine-adr` to ACCEPTED.
- `backend/` is the V2 remote realtime authority, while `server/` remains a Colyseus/AI experiment workspace. Final deployment docs should state which service is production-facing.
- `madcamp2.pdf` is currently an untracked source artifact. Decide whether to commit it or keep it outside the repo.

## Next Recommended Work

1. Expand browser accessibility coverage to full keyboard-only Launcher/Studio/Game flows.
2. Confirm drawing browser acceptance in CI/pinned environment and then update `drawing-engine-adr` status if it passes there.
3. Decide the final deployment authority between `backend/` and `server/` before default entry switch.
4. Review and approve visual evidence before creating or updating golden baselines.
