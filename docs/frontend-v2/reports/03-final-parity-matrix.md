# Frontend V2 Final Parity Matrix

작성일: 2026-07-14  
역할: legacy 삭제 전 최종 패리티 감사  
결론: **legacy removal NOT APPROVED**

## Source Order Applied

1. `docs/frontend-v2/decisions/product-decisions.md`
2. `docs/frontend-v2/contracts/screen-state-matrix.md`
3. `docs/frontend-v2/decisions/drawing-engine-adr.md`
4. `docs/frontend-v2/FINAL_PLAN.md`
5. `docs/KJH/screen-design.md`
6. legacy code/screens as behavior reference only

`FINAL_PLAN.md`의 오래된 fallback 또는 Drawing Engine 정책은 최신 결정/계약보다 우선하지 않는다.

## Verdict Legend

| Verdict | Meaning |
|---|---|
| PASS | contract, runtime path, and relevant validation evidence are complete |
| PARTIAL | useful implementation exists, but one or more required modes/tests/states are unproven |
| FAIL | required V2 parity is missing or currently placeholder/fixture-only |
| BLOCKED | cannot be verified in this environment; still not a PASS |

## Screen Parity Matrix

| Area | Contract expectation | V2 evidence | mock/local | remote/remote | Validation evidence | Verdict | Legacy removal blocker |
|---|---|---|---|---|---|---|---|
| login/session | boot restore, token validation, nickname 1-12, no mock fallback in remote | `LoginController`, `loginControllerCore`, mock/remote session ports | Implemented by mock port and storage | Static remote port exists; real server/browser flow not E2E verified | `login:check` PASS | PARTIAL | Needs browser E2E and remote server proof |
| main | avatar summary, CTAs, settings entry, asset job summary | `MainController`, `MainScreen` | Implemented | Static remote asset/session/device ports exist | `main-settings-screen` PASS, `main:check` FAIL in controller suite | FAIL | Required script is red; AppV2/main route assertion is stale |
| settings | volume/mute storage, nickname, device code issue/consume, modal a11y | Settings inside `MainScreen` and main controller core | Implemented in controller tests before failing assertion | Static remote ports exist | `main:check` FAIL | FAIL | Main/settings controller validation suite does not pass |
| warehouse | tabs, filters excluding item, detail modal, status/cooldown/offline | `WarehouseController`, `WarehouseScreen`, fixtures | Implemented | Static remote asset/job update ports exist; regeneration endpoint still contract-limited | `warehouse:check` PASS | PARTIAL | No browser/E2E/visual proof; remote regeneration is not fully contract-complete |
| avatar studio | 256x512 visible, 768x1536 workspace, production drawing adapter, submit avatar then main | App route still renders `A Avatar Studio placeholder` | Not implemented | Not implemented | No avatar studio check script | FAIL | Critical product screen is placeholder |
| asset studio | production asset studio, drawing engine, panel storage, submit stays in studio | `AssetStudioController`, `AssetStudioScreen`, drawing port | Implemented for controller/static flow | Static remote asset port exists | `asset-studio:check` PASS; drawing browser FAIL/BLOCKED | PARTIAL | Browser drawing acceptance and visual/E2E are not PASS |
| lobby | room list, create/join/quick join/password/full/playing/offline | `LobbyController`, `LobbyScreen`, room ports | Implemented | Remote REST/static realtime wrapper exists | `lobby-room:check` PASS; Playwright lobby-room FAIL/BLOCKED | PARTIAL | Two-browser E2E cannot pass in current environment |
| room | player slots, ready sync, host start, leave, reconnect | `RoomController`, `RoomScreen`, realtime ports | Implemented | Remote realtime path depends on Socket.IO abstraction but runtime dependency is not installed by default | `lobby-room:check` PASS; Playwright lobby-room FAIL/BLOCKED | PARTIAL | Remote/remote realtime not proven; browser context E2E not PASS |
| map build | production S4 controller, save segment, time vote, Phaser map editor bridge | `GamePhaseController` uses fixtures and `MapEditorPhaserBridge` | Fixture/demo only | No production Room/Game port integration | `game:check` PASS for bridge contract only | FAIL | No production controller/use case/adapter path |
| validation | PlaytestCanvas, validate result submit, phase sync | Fixture screen with `PlaytestPhaserBridge` | Fixture/demo only | No production validation API/realtime path | `game:check` PASS for bridge contract only | FAIL | Validation result is not connected to production port |
| merging | merge progress, fallback flag, merged map phase | Fixture screen only | Fixture/demo only | No production merge port/realtime path | `game:check` PASS for fixture registration only | FAIL | Merge use case is not production-connected |
| race | RaceCanvas, progress broadcast, finish, freeze/overtime mirrored by HUD | Fixture screen with `RacePhaserBridge` | Fixture/demo only | No production GameRealtime integration | `game:check` PASS for bridge contract only | FAIL | Race broadcast/final results are not production-connected |
| results | final ranking, stale/offline, leave | Fixture result screen only | Fixture/demo only | No `results:final` production path | `game:check` PASS for fixture registration only | FAIL | Final results are not wired to room/game runtime |

## Mode Parity

| Mode | Expected | Evidence | Verdict |
|---|---|---|---|
| `VITE_DATA_MODE=mock` | mock data mode for UI development and tests | login/main/warehouse/asset/lobby controller self-tests use mock ports | PARTIAL |
| `VITE_DATA_MODE=remote` | typed remote errors, no mock fallback | static remote ports exist and self-tests check no mock fallback in several areas | PARTIAL |
| `VITE_REALTIME_MODE=local` | BroadcastChannel/local only in explicit local mode | realtime self-test PASS | PARTIAL |
| `VITE_REALTIME_MODE=remote` | Socket.IO remote, no BroadcastChannel fallback | static adapter exists, but `socket.io-client` is not installed and transport reports missing dependency without injected factory | FAIL |

## Validation Command Results

| Command | Result |
|---|---|
| `npm run lint --workspace client -- --quiet` | PASS |
| `npm run smoke --workspace client` | PASS |
| `npm run tokens:check --workspace client` | PASS |
| `npm run primitives:check --workspace client` | PASS |
| `npm run core:check --workspace client` | PASS |
| `npm run shells:check --workspace client` | FAIL: StudioShell CSS contract assertion expects fixed grid string, current CSS uses width variables |
| `npm run studio:check --workspace client` | PASS |
| `npm run launcher:check --workspace client` | PASS |
| `npm run login:check --workspace client` | PASS |
| `npm run main:check --workspace client` | FAIL: controller test expects old `S3 Lobby placeholder` string |
| `npm run warehouse:check --workspace client` | PASS |
| `npm run asset-studio:check --workspace client` | PASS |
| `npm run lobby-room:check --workspace client` | PASS |
| `npm run realtime:check --workspace client` | PASS |
| `npm run game:check --workspace client` | PASS |
| `npm run build --workspace client` | PASS with Vite chunk-size warning |
| `npm run test:launcher-screenshots --workspace client` | FAIL/BLOCKED: Vite dev server hit `ENOSPC` file watcher limit |
| `npm run test:lobby-room --workspace client` | FAIL/BLOCKED: Chromium cannot launch; missing `libatk-1.0.so.0` |
| `npm run test:drawing-browser --workspace client` | FAIL/BLOCKED: Chromium cannot launch; missing `libatk-1.0.so.0` |
| `git diff --check` | PASS |
| `npm pkg get scripts.test scripts.e2e --workspace client` | no `test` or `e2e` scripts defined |

## Critical Gaps

| ID | Gap | Severity | Required before legacy removal |
|---|---|---|---|
| PARITY-001 | Avatar Studio is still placeholder in `AppV2` | Critical | Implement production view/controller/adapter and validation |
| PARITY-002 | S4/D/M/E/F Game screens are fixture/bridge previews, not production room/game controllers | Critical | Connect Room/Game/Map ports and prove phase lifecycle |
| PARITY-003 | `remote/remote` mode cannot be accepted without Socket.IO runtime dependency or approved injected runtime factory | Critical | Install/approve dependency or provide production transport factory and E2E |
| PARITY-004 | Playwright visual/E2E/browser tests do not pass in current environment | Critical | Fix CI/browser environment and run all suites |
| PARITY-005 | `shells:check` and `main:check` fail | Critical | Update implementation or tests so required scripts pass |
| PARITY-006 | Drawing Engine ADR is only `PROVISIONALLY_ACCEPTED`; browser acceptance did not pass | Critical | Pass browser drawing acceptance in CI and mark ADR accepted |
| PARITY-007 | No automated accessibility audit evidence exists for full V2 flow | Major | Add browser accessibility checks and manual audit signoff |

