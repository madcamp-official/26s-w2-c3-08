# Frontend V2 Conflict Register

작성일: 2026-07-13
상태 값: `OPEN`, `RECOMMENDED`, `APPROVED`, `MIGRATION GAP`, `RESOLVED`, `PLANNED`

- `APPROVED`: 제품/계약 결정은 확정됨.
- `MIGRATION GAP`: 확정 계약과 legacy runtime이 다르며 구현 단계에서 migration 필요.
- `RESOLVED`: 문서 오타 또는 문서 간 충돌은 정정 완료.
- `PLANNED`: V2 구현 단계에서 처리할 예정.

## C-001

| 필드 | 내용 |
|---|---|
| ID | C-001 |
| 주제 | 루트 `AGENTS.md` 부재 |
| 문서 기준 | Phase 0 목표는 `AGENTS.md`를 반드시 먼저 읽으라고 지시 |
| 코드 기준 | 저장소 루트 `AGENTS.md`가 존재하고, `client/src/game/AGENTS.md`는 Phaser gameplay 하위 경계를 계속 보호 |
| 영향 | 공통 Frontend V2 migration 규칙과 Phaser 보호 규칙을 모두 파일로 확인할 수 있음 |
| 권장안 | RESOLVED: 루트 `AGENTS.md`를 기준으로 공통 작업 규칙을 적용하고, 하위 AGENTS가 있는 경로에서는 더 구체적인 규칙도 함께 적용 |
| 상태 | RESOLVED |

## C-002

| 필드 | 내용 |
|---|---|
| ID | C-002 |
| 주제 | Backend 문서의 "코드 없음" 진술과 실제 `backend/` 코드 존재 |
| 문서 기준 | `docs/LSJ/backend.md` 섹션 0은 현재 저장소에 실제 백엔드 코드가 아직 없다고 기록 |
| 코드 기준 | `backend/src/http/app.ts`, `backend/src/http/routes/apiRoutes.ts`, `backend/src/socket/index.ts`, `backend/src/clients/qwenClient.ts`가 존재 |
| 영향 | 계획 문서를 사실로 반복하면 현재 service contract를 놓친다 |
| 권장안 | Phase 1의 backend 기준은 현재 `backend/src` 코드와 conflict register를 우선하고, `docs/LSJ/backend.md`는 과거 계획으로 취급 |
| 상태 | RECOMMENDED |

## C-003

| 필드 | 내용 |
|---|---|
| ID | C-003 |
| 주제 | Asset 생성 API path 충돌 |
| 문서 기준 | `docs/KJH/screen-design.md`는 아바타 생성 `[생성하기]`가 `POST /assets`라고 기록. `docs/LSJ/backend.md`는 `POST /assets/avatar/generate`, `POST /assets/generate`를 기록 |
| 코드 기준 | frontend는 `/api/assets/avatar/generate`를 avatar primary로 시도하고 fallback `/api/assets/generate`를 사용. backend는 `/api/assets/avatar/generate`와 `/api/assets/generate`를 모두 구현 |
| 영향 | RESOLVED: avatar primary request no longer 404s; generic endpoint remains for compatibility |
| 권장안 | V2 UI는 path를 알지 않게 하고 `client/src/net/api.ts` adapter action만 사용. Backend 최종 path는 avatar-specific `/api/assets/avatar/generate` plus generic `/api/assets/generate`로 확정 |
| 상태 | RESOLVED |

## C-004

| 필드 | 내용 |
|---|---|
| ID | C-004 |
| 주제 | Realtime transport: Colyseus vs Socket.IO vs BroadcastChannel |
| 문서 기준 | DECISION-V2-010 APPROVED. V2 MVP remote room/game realtime은 `backend/` Socket.IO 계약 우선. `server/` Colyseus는 대체 transport 후보. DECISION-V2-012에 따라 remote 실패 시 BroadcastChannel 자동 fallback 금지 |
| 코드 기준 | V2 entry uses `client/src/infrastructure/realtime/socketIoRemoteAdapters.ts` with `socket.io-client@4.8.3`; `backend/src/socket/index.ts` is the production-facing Socket.IO authority. Legacy `client/src/net/realtime.ts` still contains Colyseus SDK + BroadcastChannel fallback until legacy removal. `server/src/rooms/MyRoom.ts` remains Colyseus scaffold |
| 영향 | V2 remote contract is implemented without automatic local fallback. Legacy root remains a known migration gap and must not be used as production evidence for V2 remote mode |
| 계약 결정 | APPROVED: remote는 Socket.IO 우선, BroadcastChannel은 `VITE_REALTIME_MODE=local` 전용 |
| 레거시 런타임 불일치 | MIGRATION GAP: legacy frontend still contains Colyseus + BroadcastChannel fallback structure until final removal |
| V2 구현 | RESOLVED for V2 entry: Socket.IO remote adapter, typed offline/reconnecting state, and transport-independent ports are implemented and checked by `realtime:check`, remote browser flow, and `check:v2` |
| 감사 근거 | [01-five-decision-implementation-audit.md](../reports/01-five-decision-implementation-audit.md#5-remote-realtime은-socketio-우선) |
| 상태 | MIGRATION GAP |

## C-016

| 필드 | 내용 |
|---|---|
| ID | C-016 |
| 주제 | Data/Realtime mode default와 remote fallback 정책 |
| 문서 기준 | DECISION-V2-011/012 APPROVED. `VITE_DATA_MODE=mock|remote`, `VITE_REALTIME_MODE=local|remote`. remote 실패 시 Mock 또는 BroadcastChannel/local realtime으로 자동 fallback하지 않는다. Phase 2A acceptance 기준에 따라 development/test missing env는 `mock/local`, production missing env는 startup `ConfigurationError` |
| 코드 기준 | V2 controllers select mock/remote ports through `client/src/infrastructure/config/modeConfig.ts`; missing production env and invalid values become `ConfigurationError`. Legacy `client/src/net/api.ts` still uses legacy env names and fallback semantics until removal |
| 영향 | V2 entry has explicit data/realtime mode behavior. Legacy adapter differences remain isolated and must not be treated as V2 production behavior |
| 계약 결정 | APPROVED: explicit mode only, production missing env is configuration error, remote mode has no Mock/local automatic fallback |
| 레거시 런타임 불일치 | MIGRATION GAP: legacy root adapters still use legacy env names and fallback semantics |
| 문서 typo/conflict | RESOLVED: `data-mode-policy.md` production default/TBD 표현을 실제 `modeConfig.ts` 정책으로 정정 |
| V2 구현 | RESOLVED for V2 entry: remote data/realtime ports surface typed errors without selecting mock/local fallback; legacy adapter conversion is deferred to final removal |
| 감사 근거 | [02-phase-2a-shared-contract-foundation.md](../reports/02-phase-2a-shared-contract-foundation.md#added-explicit-mode-config) |
| 상태 | MIGRATION GAP |

## C-005

| 필드 | 내용 |
|---|---|
| ID | C-005 |
| 주제 | DB/ORM 방향과 실제 서버 패키지 분리 |
| 문서 기준 | KJH architecture는 MySQL 언급, tech-stack은 PostgreSQL + Prisma 권장, LSJ backend는 PostgreSQL + Prisma |
| 코드 기준 | `backend/package.json` is the production-facing Express REST + Socket.IO service. `server/package.json` remains the Colyseus experiment workspace. Root `check:v2` explicitly validates backend tests/typecheck/build and server tests |
| 영향 | Production service direction is no longer ambiguous for V2: deploy `backend/` as the authority; keep `server/` only as legacy/experiment until a future explicit transport decision |
| 권장안 | Use `backend/` for production REST/realtime deployment. Do not promote `server/`/Colyseus without a separate production-hardening decision and V2 adapter work |
| 상태 | APPROVED |

## C-006

| 필드 | 내용 |
|---|---|
| ID | C-006 |
| 주제 | Avatar canvas/internal buffer size 충돌 |
| 문서 기준 | DECISION-V2-002/003 APPROVED. visible canvas는 256x512, 3x3 workspace buffer는 768x1536. `screen-design.md`의 과거 `768x1024` 계산 오류는 2026-07-13 정정 완료 |
| 코드 기준 | `App.tsx` `AVATAR_CANVAS = 256x512`, `SKETCH_WORKSPACE_SCALE = 3`, `SketchBoard` workspace = `768x1536`. `shared/constants.ts` `AVATAR_CANVAS = 64x128`은 game sprite 규격 |
| 영향 | 문서 수치 충돌은 해소됨. V2 DrawingEngine 구현 시 workspace/export/eyedropper 검증이 필요 |
| 계약 결정 | APPROVED: editor visible 256x512, workspace 768x1536, game sprite 64x128 용어 분리 |
| 레거시 런타임 불일치 | 없음: audit 기준 legacy `SketchBoard`는 768x1536으로 동작 |
| 문서 typo/conflict | RESOLVED: `docs/KJH/screen-design.md`의 `768x1024`를 `768x1536`으로 정정 |
| V2 구현 | PLANNED: DrawingEngine unit/smoke 및 pixel 검증 추가 |
| 감사 근거 | [01-five-decision-implementation-audit.md](../reports/01-five-decision-implementation-audit.md#2-768x1536-workspace-buffer) |
| 상태 | RESOLVED |

## C-007

| 필드 | 내용 |
|---|---|
| ID | C-007 |
| 주제 | Avatar hitbox height 범위 충돌 |
| 문서 기준 | `docs/KJH/player-spec.md`는 1.65~1.95 tile, 105~125px 자동 클램프 |
| 코드 기준 | `shared/constants.ts`는 주석 1.3~1.95 tile, `AVATAR_HITBOX_H = { minPx: 83, maxPx: 125 }` |
| 영향 | 작은 아바타 유불리 방지 기준이 달라진다. 서버/클라 공정성 규칙 충돌 |
| 권장안 | player-spec 기준 105~125px로 shared constant를 갱신하는 별도 gameplay/shared task 필요 |
| 상태 | OPEN |

## C-008

| 필드 | 내용 |
|---|---|
| ID | C-008 |
| 주제 | Map grid/board 단위 충돌 |
| 문서 기준 | DECISION-V2-008 APPROVED. MVP map editor는 24x10 cells와 32px snap 기준. 기존 "32x32" 표현은 legacy ambiguity로만 기록 |
| 코드 기준 | `App.tsx` `EDITOR_BOARD = 24x10`; `MapEditorCanvas.tsx` `BOARD_COLS=24`, `BOARD_ROWS=10`, `CELL_PX=32`; `RaceCanvas.tsx`는 merged map mapping에 `MAP_CELL_X=96`, `MAP_CELL_Y=28` 사용 |
| 영향 | V2 editor contract는 해소됨. Race projection 값은 editor snap이 아니라 Phaser internal projection으로 계속 분리해야 함 |
| 계약 결정 | APPROVED: `24x10 board, 32px editor cell/snap` |
| 레거시 런타임 불일치 | 없음: audit 기준 current `App.tsx`/`MapEditorCanvas.tsx`와 계약 일치 |
| 문서 typo/conflict | RESOLVED: V2 문서에서는 32px snap으로 고정하고 32x32 표현은 legacy conflict로 기록 |
| V2 구현 | PLANNED: Race projection과 editor snap 용어를 UI copy/API schema에서 혼용하지 않음 |
| 감사 근거 | [01-five-decision-implementation-audit.md](../reports/01-five-decision-implementation-audit.md#3-24x10-cells--32px-snap) |
| 상태 | RESOLVED |

## C-009

| 필드 | 내용 |
|---|---|
| ID | C-009 |
| 주제 | Item 제작/노출 범위 |
| 문서 기준 | DECISION-V2-007 APPROVED. 사용자 제작 컴포넌트 카테고리는 `platform`, `obstacle`, `monster`, `background`. `item`은 V2 MVP에서 system-provided asset |
| 코드 기준 | `AssetCategory`에는 `item`이 있고 `starterAssets`/backend seed에는 system item이 있다. `AssetStudio` category는 item 제외. `Warehouse` component tab도 item 제외. `MapBuildPhase` asset shelf는 item category를 포함 |
| 영향 | 사용자 제작 UI와 backend creation endpoint 모두 user-generated `item`을 차단한다. 전역 domain/gameplay에서는 system item을 계속 허용한다 |
| 계약 결정 | APPROVED: 전역 category에는 `item`이 존재 가능, system item은 Map Build shelf 사용 가능, user-created category는 4종만 허용 |
| 레거시 런타임 불일치 | RESOLVED: backend `/api/assets/generate` returns `ASSET_CATEGORY_NOT_ALLOWED` for user-generated `item` while preserving system item seeds |
| 문서 typo/conflict | RESOLVED: `screen-design.md`와 `FINAL_PLAN.md`에 system-only item 정책 반영 |
| V2 구현 | IMPLEMENTED: 사용자 asset creation endpoint에서 `item` 거부. 시스템 seed/internal flow는 계속 허용 |
| 감사 근거 | [01-five-decision-implementation-audit.md](../reports/01-five-decision-implementation-audit.md#4-item은-system-only) |
| 상태 | RESOLVED |

## C-010

| 필드 | 내용 |
|---|---|
| ID | C-010 |
| 주제 | Phase naming `finished` vs `results` |
| 문서 기준 | LSJ plan/backend는 `RESULTS`, Socket event `results:final`을 사용 |
| 코드 기준 | frontend `RoomPhase`와 backend `RoomPhase`는 `finished`를 phase 값으로 사용하고 `results:final`은 event 이름으로만 사용 |
| 영향 | route/state machine 타입을 새로 만들 때 `results` phase를 도입하면 기존 store/backend와 어긋남 |
| 권장안 | runtime phase는 `finished`, event/display는 `results` 용어를 허용하는 식으로 구분 |
| 상태 | RECOMMENDED |

## C-011

| 필드 | 내용 |
|---|---|
| ID | C-011 |
| 주제 | Deprecated/unused `AvatarCreator` |
| 문서 기준 | 현재 사양은 256x512, guide 없음, paste/drop 차단, 통합 drawing 도구 |
| 코드 기준 | `client/src/components/AvatarCreator.tsx`는 400x400, guide silhouette, 4색/3 brush size, JSON `/api/assets/generate` POST. `rg` 결과 현재 import 없음 |
| 영향 | V2 마이그레이션 때 잘못 참조하면 구 사양이 재도입됨 |
| 권장안 | Phase 1 구현 기준에서 제외하고 삭제는 별도 cleanup 단계에서 수행 |
| 상태 | RECOMMENDED |

## C-012

| 필드 | 내용 |
|---|---|
| ID | C-012 |
| 주제 | 에셋 스튜디오 `[만들기]` 후 이동 동작 |
| 문서 기준 | DECISION-V2-005 APPROVED. 일반 에셋 생성 후 Asset Studio에 머문다. 성공 toast `에셋 생성을 요청했어요.`와 `창고에서 진행 상황 보기` CTA 제공. canvas/form/attrs/source state 유지. `[새 에셋 만들기]`에서만 초기화 |
| 코드 기준 | V2 `assetStudioControllerCore` keeps the user in Asset Studio, preserves canvas/form/source state, shows `에셋 생성을 요청했어요.`, and provides `창고에서 진행 상황 보기`. Legacy `appStore.submitAsset` still navigates non-avatar submissions to Warehouse |
| 영향 | V2 product behavior is implemented. Legacy runtime remains intentionally unchanged until final root switch/removal |
| 계약 결정 | APPROVED: non-avatar submit success stays in Asset Studio with toast/CTA and preserved state |
| 레거시 런타임 불일치 | MIGRATION GAP: legacy `appStore.submitAsset` still navigates non-avatar success to Warehouse |
| 문서 typo/conflict | RESOLVED: `screen-design.md`의 미확정 질문을 확정 항목으로 변경 |
| V2 구현 | RESOLVED for V2 entry: `asset-studio:check`, flow checks, and State Gallery cover submit stay, toast CTA, and dirty/unchanged blocking |
| 감사 근거 | [01-five-decision-implementation-audit.md](../reports/01-five-decision-implementation-audit.md#6-일반-에셋-제출-후-studio-유지) |
| 상태 | MIGRATION GAP |

## C-013

| 필드 | 내용 |
|---|---|
| ID | C-013 |
| 주제 | `shared/physics`와 `shared/schemas` source of truth integration |
| 문서 기준 | KJH architecture/tech-stack은 shared physics/schemas를 클라/서버 공통 source로 계획 |
| 코드 기준 | Phase 2A에서 `shared/schemas/index.ts`는 runtime schema foundation을 갖췄다. `shared/physics/index.ts`와 실제 gameplay 규칙은 여전히 `App.tsx`, `assetRules.ts`, `PlaytestCanvas.tsx`, `RaceCanvas.tsx`, backend route local types에 분산 |
| 영향 | schema foundation은 생겼지만 V2 adapter/backend가 shared schema를 아직 사용하지 않으므로 저장 검증과 UI form 검증이 어긋날 위험은 남아 있다 |
| 계약 결정 | APPROVED: Phase 2A shared schema/port foundation은 생성됨 |
| 레거시 런타임 불일치 | MIGRATION GAP: legacy runtime/backend local types are not yet wired to shared schemas |
| V2 구현 | PLANNED: adapter/backend integration 단계에서 shared schema를 연결하고 physics source of truth는 별도 gameplay/shared task로 분리 |
| 상태 | MIGRATION GAP |

## C-014

| 필드 | 내용 |
|---|---|
| ID | C-014 |
| 주제 | Qwen/WAN pipeline과 current asset generation mock |
| 문서 기준 | `ai-pipeline.md`와 `docs/LSJ/backend.md`는 Qwen/WAN/ComfyUI 비동기 job을 중요 계약으로 기록. DECISION-V2-009 APPROVED: Asset job 상태는 push 우선, asset job에 한해서만 bounded polling fallback 허용 |
| 코드 기준 | Backend exposes `/api/assets/avatar/generate`, `/api/assets/generate`, `/api/assets/generation-jobs/:jobId`, `/api/asset-jobs`, `/api/ai/jobs/next`, and `/api/ai/jobs/:jobId/result`. `backend/src/socket/index.ts` emits `asset_job:updated`; `gpu-worker/src/index.ts` runs Qwen prompt refinement, WAN sprite generation, and generated image materialization through local or HTTP PUT storage modes |
| 영향 | Asset job push, bounded polling, worker claim/result, and Qwen/WAN worker paths are implemented. Final production credentials/storage/deployment values remain external inputs |
| 계약 결정 | APPROVED: Socket push 우선, bounded polling fallback은 Asset job 전용 |
| 레거시 런타임 불일치 | 없음 for V2 entry; legacy/demo mock progression can remain until default switch |
| V2 구현 | RESOLVED for backend/gpu-worker contract tests: job push, direct job lookup, worker lease validation, stale completion rejection, Qwen/WAN request mapping, and image storage modes are covered |
| 상태 | RESOLVED |

## C-015

| 필드 | 내용 |
|---|---|
| ID | C-015 |
| 주제 | Phaser 보호 경계와 V2 UI 재구축 범위 |
| 문서 기준 | 사용자는 현재 UI를 전부 제거하고 새 UI를 만들 계획. `client/src/game/AGENTS.md`는 Phaser gameplay 변경을 금지 |
| 코드 기준 | 게임 규칙은 `MapEditorCanvas.tsx`, `PlaytestCanvas.tsx`, `RaceCanvas.tsx`, `assetRules.ts`에 포함 |
| 영향 | V2 작업자가 UI 제거 범위를 Phaser scene까지 넓히면 gameplay regression 위험 |
| 권장안 | Phase 1 write scope에서 `client/src/game/**`는 wrapper contract 필요 시에만 변경하고, gameplay constants/rules는 별도 명시 task에서만 변경 |
| 상태 | APPROVED |
