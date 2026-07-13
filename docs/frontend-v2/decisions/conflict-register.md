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
| 코드 기준 | 저장소 루트 `AGENTS.md`는 없고 `client/src/game/AGENTS.md`만 존재 |
| 영향 | 전체 저장소 공통 작업 규칙은 없음. Phaser 보호 규칙은 하위 디렉터리 기준으로만 적용 가능 |
| 권장안 | Phase 1 전 루트 `AGENTS.md`를 만들지 여부를 결정. 현재 감사 문서는 하위 Phaser 규칙만 적용 |
| 상태 | OPEN |

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
| 코드 기준 | frontend는 `/api/assets/avatar/generate`를 avatar primary로 시도하고 fallback `/api/assets/generate`를 사용. backend는 `/api/assets/generate`만 구현 |
| 영향 | remote mode에서 avatar primary request는 404 후 fallback 될 수 있다. 오류 처리 UI가 원인을 알기 어렵다 |
| 권장안 | V2 UI는 path를 알지 않게 하고 `client/src/net/api.ts` adapter action만 사용. Backend 최종 path는 `/api/assets/generate` 단일 또는 `/api/assets/avatar/generate` 추가 중 하나로 결정 |
| 상태 | OPEN |

## C-004

| 필드 | 내용 |
|---|---|
| ID | C-004 |
| 주제 | Realtime transport: Colyseus vs Socket.IO vs BroadcastChannel |
| 문서 기준 | DECISION-V2-010 APPROVED. V2 MVP remote room/game realtime은 `backend/` Socket.IO 계약 우선. `server/` Colyseus는 대체 transport 후보. DECISION-V2-012에 따라 remote 실패 시 BroadcastChannel 자동 fallback 금지 |
| 코드 기준 | frontend `client/src/net/realtime.ts`는 Colyseus SDK + BroadcastChannel fallback. `backend/src/socket/index.ts`는 Socket.IO. `server/src/rooms/MyRoom.ts`는 Colyseus scaffold |
| 영향 | V2 remote contract와 legacy frontend adapter가 다르다. remote 실패가 local fallback으로 숨겨지면 production 오류를 발견하지 못한다 |
| 계약 결정 | APPROVED: remote는 Socket.IO 우선, BroadcastChannel은 `VITE_REALTIME_MODE=local` 전용 |
| 레거시 런타임 불일치 | MIGRATION GAP: frontend는 아직 Colyseus + BroadcastChannel fallback 구조 |
| V2 구현 | PLANNED: Socket.IO remote adapter, typed offline/reconnecting state, transport-independent port 적용 |
| 감사 근거 | [01-five-decision-implementation-audit.md](../reports/01-five-decision-implementation-audit.md#5-remote-realtime은-socketio-우선) |
| 상태 | MIGRATION GAP |

## C-016

| 필드 | 내용 |
|---|---|
| ID | C-016 |
| 주제 | Data/Realtime mode default와 remote fallback 정책 |
| 문서 기준 | DECISION-V2-011/012 APPROVED. `VITE_DATA_MODE=mock|remote`, `VITE_REALTIME_MODE=local|remote`. remote 실패 시 Mock 또는 BroadcastChannel/local realtime으로 자동 fallback하지 않는다. Phase 2A acceptance 기준에 따라 development/test missing env는 `mock/local`, production missing env는 startup `ConfigurationError` |
| 코드 기준 | `client/src/infrastructure/config/modeConfig.ts`는 missing development/test env를 `mock/local`로 해석하고, missing production env와 invalid value를 `ConfigurationError`로 처리한다. legacy `client/src/net/api.ts`는 아직 `VITE_REMOTE_API`, legacy `client/src/net/realtime.ts`는 아직 `VITE_LOCAL_REALTIME`와 Colyseus/local path를 사용한다 |
| 영향 | 문서의 production default TBD/remote 권장 표현은 해소됨. legacy adapter가 새 mode config를 사용하기 전까지 remote 지원을 완료로 주장할 수 없다 |
| 계약 결정 | APPROVED: explicit mode only, production missing env is configuration error, remote mode has no Mock/local automatic fallback |
| 레거시 런타임 불일치 | MIGRATION GAP: existing API/realtime adapters still use legacy env names and fallback semantics |
| 문서 typo/conflict | RESOLVED: `data-mode-policy.md` production default/TBD 표현을 실제 `modeConfig.ts` 정책으로 정정 |
| V2 구현 | PLANNED: G1 Data/Realtime Mode Adapter에서 legacy API/realtime adapters를 `modeConfig.ts`와 port/adapter 구조에 연결 |
| 감사 근거 | [02-phase-2a-shared-contract-foundation.md](../reports/02-phase-2a-shared-contract-foundation.md#added-explicit-mode-config) |
| 상태 | MIGRATION GAP |

## C-005

| 필드 | 내용 |
|---|---|
| ID | C-005 |
| 주제 | DB/ORM 방향과 실제 서버 패키지 분리 |
| 문서 기준 | KJH architecture는 MySQL 언급, tech-stack은 PostgreSQL + Prisma 권장, LSJ backend는 PostgreSQL + Prisma |
| 코드 기준 | `backend/package.json`은 Prisma 6 + Socket.IO backend, `server/package.json`은 Prisma 7 + Colyseus scaffold. Root workspace는 `backend` 제외 |
| 영향 | DB schema/source of truth가 둘로 갈릴 수 있고 root workspace build가 backend를 검증하지 않는다 |
| 권장안 | Phase 1 전에 backend와 server 중 배포 대상 service를 결정하고 root workspace 포함 여부를 결정 |
| 상태 | OPEN |

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
| 코드 기준 | `AssetCategory`에는 `item`이 있고 `starterAssets`에는 system item이 있다. `AssetStudio` category는 item 제외. `Warehouse` component tab도 item 제외. `MapBuildPhase` asset shelf는 item category를 포함 |
| 영향 | 사용자 제작 UI는 계약과 대체로 일치하지만, API/domain layer는 아직 user-generated `item`을 받을 수 있다 |
| 계약 결정 | APPROVED: 전역 category에는 `item`이 존재 가능, system item은 Map Build shelf 사용 가능, user-created category는 4종만 허용 |
| 레거시 런타임 불일치 | MIGRATION GAP: backend/API schema가 user asset creation의 `item`을 아직 거부하지 않음 |
| 문서 typo/conflict | RESOLVED: `screen-design.md`와 `FINAL_PLAN.md`에 system-only item 정책 반영 |
| V2 구현 | PLANNED: 사용자 asset creation endpoint에서 `item` 거부. 시스템 seed/internal flow는 계속 허용 |
| 감사 근거 | [01-five-decision-implementation-audit.md](../reports/01-five-decision-implementation-audit.md#4-item은-system-only) |
| 상태 | MIGRATION GAP |

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
| 코드 기준 | `appStore.submitAsset`은 avatar면 `view: 'main'`, non-avatar면 `view: 'warehouse'`, `warehouseTab: 'component'` |
| 영향 | 제품 결정은 확정됐지만 legacy runtime은 non-avatar submit 후 Warehouse로 이동한다 |
| 계약 결정 | APPROVED: non-avatar submit success stays in Asset Studio with toast/CTA and preserved state |
| 레거시 런타임 불일치 | MIGRATION GAP: current `appStore.submitAsset` still navigates non-avatar success to Warehouse |
| 문서 typo/conflict | RESOLVED: `screen-design.md`의 미확정 질문을 확정 항목으로 변경 |
| V2 구현 | PLANNED: `submitComponentAsset` controller/store success flow, toast CTA, dirty/content hash duplicate block 구현 |
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
| 코드 기준 | frontend `createAsset`는 `/api/assets/generate`를 호출하고 backend `apiRoutes`는 in-memory asset을 생성한 뒤 2초/8초 mock progression으로 ready 처리. Qwen route는 `/internal/qwen/refine`에 별도 존재 |
| 영향 | UI progress는 동작하지만 실제 AI pipeline 상태와 job status contract가 불완전. backend Socket.IO는 아직 `asset_job:updated`를 emit하지 않고 job status route도 없음 |
| 계약 결정 | APPROVED: Socket push 우선, bounded polling fallback은 Asset job 전용 |
| 레거시 런타임 불일치 | MIGRATION GAP: current backend job push/route 없음, frontend는 list refresh/mock progression 중심 |
| V2 구현 | PLANNED: polling interval, 최대 지속시간, 중단 조건은 `data-mode-policy.md`/`realtime-contract.md`를 따른다. Qwen/WAN 상세는 adapter contract 확정 전 노출하지 않음 |
| 상태 | MIGRATION GAP |

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
