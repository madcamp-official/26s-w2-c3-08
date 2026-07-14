# Frontend V2 Product Decisions

작성일: 2026-07-13  
범위: Phase 1 제품/계약 설계. 런타임 구현은 하지 않는다.

## 1. 기준

이 문서는 사용자가 승인한 `DECISION-V2-001`부터 `DECISION-V2-015`를 제품 결정으로 잠근다. 현재 코드가 다르게 동작하는 경우 제품 결정을 다시 추측하지 않고 `Migration gap`으로 기록한다.

근거:

- `docs/frontend-v2/FINAL_PLAN.md`
- `docs/frontend-v2/reports/*`
- `docs/frontend-v2/decisions/conflict-register.md`
- `docs/KJH/screen-design.md`
- `docs/KJH/asset-attributes.md`
- `docs/KJH/player-spec.md`
- `docs/KJH/ai-pipeline.md`
- `docs/LSJ/plan.md`
- `docs/LSJ/backend.md`
- `client/src/types/domain.ts`
- `client/src/net/api.ts`
- `client/src/net/realtime.ts`
- `client/src/store/appStore.ts`
- `client/src/App.tsx`
- `client/src/game/MapEditorCanvas.tsx`
- `client/src/game/PlaytestCanvas.tsx`
- `client/src/game/RaceCanvas.tsx`
- `backend/src/http/routes/apiRoutes.ts`
- `backend/src/socket/index.ts`

주의:

- 루트 `AGENTS.md`는 현재 없다. Phaser 보호 규칙은 `client/src/game/AGENTS.md`를 기준으로 한다.
- `client/src/game/**`는 gameplay 보호 경계다. V2 UI 작업은 wrapper contract, lifecycle, resize, typed bridge, 접근성 주변 UI에 한정한다.

## 2. Approved Decisions

| ID | Status | Decision | Current code evidence | Migration gap |
|---|---|---|---|---|
| DECISION-V2-001 | APPROVED | 기존 UI는 최종 제거하지만 V2 전체 parity 전까지 실행 가능한 상태로 보존한다. | `client/src/App.tsx`, `client/src/App.css`가 현재 전체 UI를 구동한다. | legacy 제거는 migration gate 통과 후 수행한다. |
| DECISION-V2-002 | APPROVED | 아바타 visible canvas는 256x512이고 논리 비율은 1x2다. | `App.tsx` `AVATAR_CANVAS = { width: 256, height: 512 }`; `player-spec.md` 1x2. | `shared/constants.ts`의 `AVATAR_CANVAS = 64x128`은 game sprite 규격으로 용어 분리 필요. |
| DECISION-V2-003 | APPROVED | 아바타 3x3 workspace buffer는 768x1536이다. 기존 문서의 768x1024는 수정 대상이다. | `App.tsx` `SKETCH_WORKSPACE_SCALE = 3`, visible 256x512. | `screen-design.md`의 768x1024 표현은 legacy conflict로 유지하고 구현 시 문서 보정 필요. |
| DECISION-V2-004 | APPROVED | checker와 grid는 표시 전용 overlay다. export와 eyedropper source에 포함하지 않는다. | `SketchBoard`는 workspace export 후 visible frame crop을 수행한다. | V2 DrawingEngine interface에 overlay/exclusion 테스트가 필요하다. |
| DECISION-V2-005 | APPROVED | 일반 에셋 생성 후 Asset Studio에 머문다. 성공 toast와 "창고에서 진행 상황 보기" CTA를 표시한다. canvas/form은 유지하고 새 에셋 만들기에서만 초기화한다. | V2 `assetStudioControllerCore` preserves canvas/form/source state, shows `에셋 생성을 요청했어요.` toast, and exposes a Warehouse CTA. Legacy `appStore.submitAsset` still navigates non-avatar submissions to Warehouse until legacy removal. | RESOLVED for V2 entry; legacy root difference remains isolated until final removal. |
| DECISION-V2-006 | APPROVED | 아바타 제출 후 Main으로 이동한다. | 현재 `appStore.submitAsset`은 avatar 제출 후 `view: 'main'`으로 이동한다. | 없음. V2에서 toast 여부만 별도 디자인 가능. |
| DECISION-V2-007 | APPROVED | 사용자 제작 컴포넌트 카테고리는 `platform`, `obstacle`, `monster`, `background`다. `item`은 V2 MVP에서 system-provided asset이다. | `AssetStudio`의 `studioCategories`는 item/avatar 제외. `Warehouse` component filter도 item 제외. Backend `/api/assets/generate` rejects user-generated `item` with `ASSET_CATEGORY_NOT_ALLOWED` while preserving system item seeds. | `MapBuildPhase` shelf는 system item을 배치 대상으로 포함하므로 user-created와 system shelf 구분 필요. |
| DECISION-V2-008 | APPROVED | MVP map editor는 24x10 cells와 32px snap 기준이다. 기존 문서의 "32x32" 의미는 legacy conflict로 기록한다. | `App.tsx` `EDITOR_BOARD = 24x10`; `MapEditorCanvas.tsx` `BOARD_COLS=24`, `BOARD_ROWS=10`, `CELL_PX=32`. | LSJ 문서의 32x32 표현은 pixel snap으로만 해석한다. |
| DECISION-V2-009 | APPROVED | Asset job 상태는 push 우선이고 asset job에 한해 제한적 polling fallback을 허용한다. | V2 uses `client/src/infrastructure/warehouse/remoteAssetJobUpdates.ts` for Socket.IO `asset_job:updated` plus bounded `/api/asset-jobs` polling. `backend/src/http/routes/apiRoutes.ts` exposes direct job status under `/api/assets/generation-jobs/:jobId` and worker claim/result endpoints under `/api/ai/jobs/*`; `backend/src/socket/index.ts` broadcasts asset job updates. | Final durable image storage and deployed worker/generator credentials still need production values. |
| DECISION-V2-010 | APPROVED | V2 MVP remote room/game realtime은 production-facing `backend/` Socket.IO 계약을 우선한다. `server/` Colyseus는 legacy/experiment workspace로만 보존한다. UI/feature 계층은 transport에 의존하지 않는다. | `client/src/infrastructure/realtime/socketIoRemoteAdapters.ts` and `backend/src/socket/index.ts` implement the current V2 remote path. `npm run dev:v2` starts `backend/` and the Vite V2 client in remote/remote mode. `server/` remains a supporting experiment workspace. Hosted `Frontend V2 Browser Gates` pass on latest workflow-covered run `29353212273` for commit `1dd8ef3`. | Staging confirmation with final production environment values is still required before default entry switch. |
| DECISION-V2-011 | APPROVED | `VITE_DATA_MODE=mock|remote`를 사용한다. remote 실패 시 Mock으로 자동 fallback하지 않는다. | `client/src/infrastructure/config/modeConfig.ts` resolves explicit data mode; V2 controllers select mock or remote ports by mode. Remote port failures surface typed errors. | Staging must verify remote mode against production environment values. |
| DECISION-V2-012 | APPROVED | `VITE_REALTIME_MODE=local|remote`를 사용한다. remote 실패 시 BroadcastChannel로 자동 fallback하지 않는다. | `client/src/infrastructure/realtime/realtimeAdapters.ts` selects Socket.IO for `remote` and BroadcastChannel only for explicit `local`. | Staging must verify reconnect/offline behavior against production Socket.IO. |
| DECISION-V2-013 | APPROVED | Figma Variables와 CSS tokens는 동일 token source를 사용한다. Code-first V2의 원본 파일은 `design/tokens.json`이다. | `design/tokens.json`, `scripts/generate-design-tokens.mjs`, `client/src/styles/tokens.generated.css`, and `npm run tokens:check --workspace client` are implemented. | RESOLVED for code-first source of truth; final Figma variable application remains design-tool follow-up, not runtime blocker. |
| DECISION-V2-014 | APPROVED | S1, S2, S2b, S2c, A, B는 `screen-design.md` 확정 사양을 따른다. S3, C, S4, D, E, F는 현재 MVP 동작을 분석해 V2 화면 계약을 먼저 작성한 뒤 디자인한다. | `screen-design.md`는 S1-B 확정, S3-F 대기. `App.tsx`는 S3-F 현재 MVP 동작 구현. | Figma frame은 S3-F 계약 확정 후 생성한다. |
| DECISION-V2-015 | APPROVED | Playwright E2E와 screenshot 기반 시각 검증은 V2 완료 게이트다. | Browser configs cover Launcher, Studio, Game evidence screenshots, accessibility, drawing browser acceptance, and remote V2 flow. Evidence screenshots write under `client/test-results/**/evidence` with 1280x720, 1440x900, and 1920x1080 matrices. Hosted `Drawing Engine Browser Acceptance` run `29349726560` and `Frontend V2 Browser Gates` latest workflow-covered run `29353212273` for commit `1dd8ef3` pass. | Product approval of visual golden baselines remains before default entry switch. |

## 3. Contract-Level Consequences

- 화면은 API path, socket event, storage key를 직접 알면 안 된다.
- 화면은 controller callback 이름만 알고, controller/store/adapter가 실제 API와 realtime transport를 소유한다.
- V2 route는 문자열 view 이동이 아니라 discriminated union route model을 목표로 한다.
- `mock` mode와 `remote` mode는 서로 다른 명시 모드다. remote 실패는 fallback이 아니라 typed error다.
- asset job은 push가 우선이다. polling은 asset job에만 제한하고, rooms/game realtime에는 자동 local fallback을 허용하지 않는다.
- Phaser는 controlled island다. React는 commands/props를 내려보내고 typed events를 받되 gameplay rule ownership을 가져오지 않는다.

## 4. Open Contract Notes

다음은 제품 결정이 아니라 backend 또는 implementation contract 확정이 필요한 항목이다.

| ID | Item | Status |
|---|---|---|
| TBD-CONTRACT-PD-001 | Asset generation backend가 `/api/assets/generate` 단일 endpoint를 유지할지, avatar-specific endpoint를 추가할지 결정 필요. | RESOLVED: keep `/api/assets/generate` as the generic asset endpoint and add `/api/assets/avatar/generate` as the avatar-specific FormData/JSON endpoint used by the current client adapter primary path. |
| TBD-CONTRACT-PD-002 | Asset job push event `asset_job:updated`를 backend Socket.IO worker가 언제/어떤 payload로 emit할지 결정 필요. | RESOLVED: `backend/src/socket/index.ts` broadcasts `asset_job:updated` from `apiRoutes.ts emitAssetJobUpdated`; direct REST job lookup exists at `/api/assets/generation-jobs/:jobId`. |
| TBD-CONTRACT-PD-003 | nickname update가 local session만 바꾸는지 remote `users.nickname` update를 추가하는지 결정 필요. | RESOLVED: V2 remote settings uses `/api/session/nickname`; mock mode keeps local mock session update. A separate `users.nickname` resource is not required for MVP. |
| TBD-CONTRACT-PD-004 | `design/tokens.json` schema와 Figma variable collection naming 결정 필요. | RESOLVED for code-first V2: `design/tokens.json` is the runtime token source with `cssVariable` metadata and generated CSS; Figma variable collection naming is no longer a runtime source-of-truth blocker. |
| TBD-CONTRACT-PD-005 | Playwright screenshot baseline 저장 위치와 viewport matrix 결정 필요. | PARTIAL: evidence screenshots are generated under `client/test-results/**/evidence` for 1280x720, 1440x900, and 1920x1080. Golden/baseline storage and approval owner remain product review before default switch. |
