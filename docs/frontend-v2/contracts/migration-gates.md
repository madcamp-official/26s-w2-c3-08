# Frontend V2 Migration Gates

작성일: 2026-07-13  
목적: V2 구현 전/중/완료 시 반드시 통과해야 하는 gate를 정의한다.

## 1. Gate Summary

| Gate | Required before | Pass criteria |
|---|---|---|
| G0 Contract Freeze | any runtime implementation | 이 문서 세트가 존재하고 TBD-CONTRACT가 known blocker로 분리됨 |
| G1 Data/Realtime Mode Adapter | V2 screens call services | `VITE_DATA_MODE`, `VITE_REALTIME_MODE` semantics implemented; no silent fallback in remote mode |
| G2 Route Model | replacing app shell | V2 route discriminated union maps all S1-F + M screens |
| G3 Screen Parity | legacy removal | S1, S2, S2b, S2c, A, B, S3, C, S4, D, M, E, F states covered |
| G4 Phaser Bridge | game HUD replacement | MapEditor/Playtest/Race wrappers mount, sync, cleanup, and expose DOM status |
| G5 Drawing Contract | studio release | 256x512 avatar, 768x1536 workspace, overlay-excluded export/eyedropper verified |
| G6 API Contract | remote mode demo | required REST actions work or fail with typed errors; no mock fallback |
| G7 Realtime Contract | multiplayer demo | Socket.IO room/game events work for 2 clients or blockers are explicit |
| G8 Visual/E2E | V2 completion | Playwright E2E and screenshot validation pass |
| G9 Legacy Removal | final cleanup | old UI JSX/CSS deleted only after parity gates pass |

## 2. Required Command Gates

| Command | Required at | Notes |
|---|---|---|
| `npm run lint --workspace client -- --quiet` | every implementation wave | existing Phase 0 baseline passes |
| `npm run smoke --workspace client` | every implementation wave | existing smoke 16/16 baseline |
| `npm run build --workspace client` | every implementation wave | Vite large chunk warning is known baseline |
| `git diff --check` | every documentation/implementation wave | whitespace gate |
| Playwright E2E | V2 completion gate | missing today; must be added |
| Playwright screenshots | V2 completion gate | viewports: 1280x720, 1440x900, 1920x1080 minimum |

## 3. E2E Flow Gates

| Flow | Must verify |
|---|---|
| Login/Main | no session -> login -> main; stored session restore |
| Warehouse | avatar/component tabs, empty, queued/generating/ready/failed, detail modal, cooldown |
| Settings | volume/mute persistence, device code issue/consume error states |
| Avatar Studio | 256x512 export, paste/drop blocked, submit -> main |
| Asset Studio | n x m export, attrs, loaded unchanged blocked, submit stay + toast + warehouse CTA |
| Lobby/Room | public/private create/join, ready/start, disabled full/running room |
| Build | 24x10 board, 32px snap, overlap/budget/endpoint guard, submit lock |
| Validation | clear/fail record, timeout, phase advance |
| Merge/Race/Results | fallback merge, race progress, freeze penalty, overtime, ranking |

## 4. Screenshot Gates

| Screen | States |
|---|---|
| S1 | default, validation error, loading |
| S2 | default avatar, generating avatar, failed avatar |
| S2b | empty, mixed status grid, detail modal |
| S2c | default, issued code, invalid code |
| A | blank, loaded unchanged, submitting/error |
| B | default, collapsed panels, success toast |
| S3 | empty room list, create form, password modal |
| C | host, non-host ready, realtime offline |
| S4 | normal editing, locked, build test modal |
| D | playing, cleared, failed/timeout |
| M | merging, fallback |
| E | normal, freeze, overtime |
| F | winner, unfinished players, local highlight |

## 5. Blockers Before Phase 2 Implementation

| ID | Blocker | Why it blocks |
|---|---|---|
| BLOCKER-001 | API remote fallback policy must be implemented before claiming remote support. | Current adapter silently falls back to mock. |
| BLOCKER-002 | Realtime remote transport must be chosen in implementation. | Product decision says Socket.IO backend; current frontend uses Colyseus SDK. |
| BLOCKER-003 | Asset Studio success behavior must change to stay + toast. | Current store navigates to warehouse. |
| BLOCKER-004 | Playwright/screenshot infra must exist before V2 complete. | DECISION-V2-015 makes it a completion gate. |

## 6. Non-Blockers

| Item | Reason |
|---|---|
| Colyseus `server/` scaffold not production-ready | Documented as alternative transport only. |
| `shared/physics` and `shared/schemas` stubs | UI can begin against current code contract, but shared hardening remains follow-up. |
| Qwen/WAN full pipeline incomplete | UI can display generic asset job states and failure. |
| Figma frames absent | Contract-first screens S3-F are allowed before design generation. |
