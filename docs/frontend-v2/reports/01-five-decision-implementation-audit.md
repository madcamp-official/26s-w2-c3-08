# Frontend V2 Five Decision Implementation Audit

작성일: 2026-07-13  
범위: 사용자가 요청한 다섯 항목을 `product-decisions.md`, `screen-state-matrix.md`, 현재 코드 기준으로 확인한다. 런타임 코드는 수정하지 않는다.

## 1. 요약

| 항목 | 계약 문서 상태 | 현재 런타임 상태 | 판정 |
|---|---|---|---|
| 768x1536 workspace buffer | `product-decisions.md`에서 APPROVED | 기존 `SketchBoard` 경로는 256x512 * 3 = 768x1536으로 동작 | PASS, V2 DrawingEngine 검증 필요 |
| 24x10 cells / 32px snap | `product-decisions.md`, `screen-state-matrix.md`, `phaser-bridge.md`에 고정 | `App.tsx`와 `MapEditorCanvas.tsx`가 24x10, 32px 기준 | PASS |
| item은 system-only | 계약상 user-created category에서 제외 | Studio/Warehouse UI는 제외, Map shelf는 system item 포함, backend user creation은 item 거부 | PASS |
| remote realtime은 Socket.IO 우선 | 계약상 Socket.IO backend 우선 | backend는 Socket.IO, frontend adapter는 Colyseus + BroadcastChannel | NOT IMPLEMENTED |
| 일반 에셋 제출 후 Studio 유지 | 계약상 stay + toast + warehouse CTA | `appStore.submitAsset`은 non-avatar 제출 후 Warehouse로 이동 | NOT IMPLEMENTED |

## 2. 768x1536 Workspace Buffer

### 계약 상태

- `docs/frontend-v2/decisions/product-decisions.md` `DECISION-V2-002`: visible canvas는 256x512, 논리 비율은 1x2.
- `docs/frontend-v2/decisions/product-decisions.md` `DECISION-V2-003`: 3x3 workspace buffer는 768x1536.
- `docs/frontend-v2/contracts/screen-state-matrix.md` `A_AVATAR_STUDIO`: visible data는 256x512 visible canvas.

### 코드 근거

- `client/src/App.tsx`:
  - `AVATAR_CANVAS = { width: 256, height: 512 }`
  - `SKETCH_WORKSPACE_SCALE = 3`
  - `SketchBoard` 내부에서 `sketchWidth = width * SKETCH_WORKSPACE_SCALE`, `sketchHeight = height * SKETCH_WORKSPACE_SCALE`
  - avatar 화면은 `SketchBoard`에 `width={AVATAR_CANVAS.width}`, `height={AVATAR_CANVAS.height}`를 전달한다.

따라서 avatar editor 기준 workspace는 다음 계산으로 확정된다.

```text
width  = 256 * 3 = 768
height = 512 * 3 = 1536
```

### Export/Eyedropper 확인

- `SketchBoard`는 전체 workspace image를 먼저 export하고, `exportFrame = { x: width, y: height, width, height }`를 crop한다.
- visible avatar frame은 workspace 중앙 256x512 영역이며, 제출 이미지는 이 frame을 crop한 결과다.
- eyedropper도 workspace 좌표를 기준으로 sampling하되, reference image가 있을 경우 visible export frame 내부에서 합성 sampling을 수행한다.

### 판정

현재 legacy 구현 경로에서는 PASS다. 다만 V2 구현 기준에서는 아직 별도 `DrawingEngine` interface가 없으므로 다음 gate가 필요하다.

- avatar 256x512 입력 시 workspace가 정확히 768x1536인지 unit/smoke 검증.
- checker/grid overlay가 export와 eyedropper source에 섞이지 않는지 screenshot/pixel 검증.
- `docs/KJH/screen-design.md`의 기존 768x1024 표현은 legacy conflict로 유지하거나 별도 문서 보정.

## 3. 24x10 Cells / 32px Snap

### 계약 상태

- `docs/frontend-v2/decisions/product-decisions.md` `DECISION-V2-008`: MVP map editor는 24x10 cells와 32px snap.
- `docs/frontend-v2/contracts/screen-state-matrix.md` `S4_MAP_BUILD`: visible data에 24x10 Phaser board를 명시.
- `docs/frontend-v2/contracts/phaser-bridge.md`: `MapEditorCanvas`는 24x10, 32px snap을 bridge contract로 고정.

### 코드 근거

- `client/src/App.tsx`:
  - `EDITOR_BOARD = { cols: 24, rows: 10 }`
  - placement board bounds 검사도 `EDITOR_BOARD.cols`, `EDITOR_BOARD.rows`를 기준으로 한다.
- `client/src/game/MapEditorCanvas.tsx`:
  - `BOARD_COLS = 24`
  - `BOARD_ROWS = 10`
  - `CELL_PX = 32`
  - pointer/drop 좌표를 cell로 바꿀 때 `BOARD_COLS`, `BOARD_ROWS`, `CELL_PX`를 사용한다.

### 관련 주의점

- `RaceCanvas.tsx`에는 race rendering projection용 `MAP_CELL_X = 96`, `MAP_CELL_Y = 28`이 있다. 이것은 editor snap 기준이 아니라 merged map을 race scene에 표시하기 위한 내부 projection으로 분리해서 보아야 한다.
- LSJ 문서의 "32x32" 표현은 V2 계약에서 32px snap으로 해석한다.

### 판정

PASS다. 현재 코드와 계약이 일치한다.

## 4. Item은 System-Only

### 계약 상태

- `docs/frontend-v2/decisions/product-decisions.md` `DECISION-V2-007`: user-created component category는 `platform`, `obstacle`, `monster`, `background`; `item`은 system-provided asset.
- `docs/frontend-v2/contracts/screen-state-matrix.md`:
  - Warehouse: item hidden from user-created component filter.
  - Asset Studio: item/avatar not selectable as user-created category.

### 코드 근거: UI/API가 일치

- `client/src/App.tsx`:
  - `StudioCategory = Exclude<AssetCategory, 'avatar' | 'item'>`
  - `studioCategories = ['platform', 'obstacle', 'monster', 'background']`
  - `AssetLoadModal`은 `asset.category !== 'avatar' && asset.category !== 'item'`만 loadable로 본다.
  - `Warehouse` component tab/filter도 `avatar`와 `item`을 제외한다.
- `client/src/net/api.ts` starter assets에는 system item이 존재한다.
  - `system-item-speed`
  - `system-item-giant-mushroom`
  - `system-item-switch`
- `backend/src/http/routes/apiRoutes.ts`:
  - `/api/assets/generate`는 user-generated `item` 요청을 `ASSET_CATEGORY_NOT_ALLOWED`로 거부한다.
  - backend default seed는 system item 3종을 유지한다.
- `MapBuildPhase` asset shelf category에는 `item`이 포함된다. 이는 system-provided item을 배치 대상으로 노출하기 위한 흐름으로 계약과 양립 가능하다.

### 닫힌 gap: API/domain user creation boundary

- `client/src/types/domain.ts` `AssetCategory`에는 `item`이 계속 포함된다. 이는 system item과 gameplay placement를 위한 전역 domain 표현이다.
- backend user creation route는 `item`을 명시적으로 거부하므로 user-created boundary는 계약을 만족한다.

### 판정

PASS다.

- User-facing Studio/Warehouse 기준: PASS.
- Service/API hardening 기준: PASS.

V2 remote mode에서 이 결정은 현재 backend contract test로 검증된다.

## 5. Remote Realtime은 Socket.IO 우선

### 계약 상태

- `docs/frontend-v2/decisions/product-decisions.md` `DECISION-V2-010`: V2 MVP remote room/game realtime은 `backend/` Socket.IO 계약 우선.
- `docs/frontend-v2/contracts/realtime-contract.md`: `VITE_REALTIME_MODE=remote`는 backend Socket.IO를 사용하고, Colyseus는 대체 transport 후보.
- `docs/frontend-v2/contracts/data-mode-policy.md`: remote realtime 실패 시 BroadcastChannel 자동 fallback 금지.

### 코드 근거: backend는 Socket.IO

- `backend/src/socket/index.ts`:
  - `import { Server, type Socket } from "socket.io"`
  - `room:join`, `room:start`, `phase:ready`, `time_vote:request`, `segment:submitted`, `validation:completed`, `race:position`, `race:finish` 등을 처리한다.
  - `phase:changed`, `timer:tick`, `room:state`, `map:merged`, `results:final` 등을 emit한다.

### 코드 근거: frontend는 아직 Socket.IO가 아님

- `client/src/net/realtime.ts`:
  - `import { Client, type Room } from '@colyseus/sdk'`
  - `COLYSEUS_URL`, `COLYSEUS_ROOM_NAME`를 사용한다.
  - `BroadcastChannel('relay.localRealtime.v1')` fallback을 설정한다.
  - fallback enable flag는 `VITE_LOCAL_REALTIME !== 'false'`다.
- `client/package.json`에는 현재 `@colyseus/sdk`가 있고, Socket.IO client dependency는 확인되지 않았다.

### 판정

NOT IMPLEMENTED다.

계약 문서는 Socket.IO 우선으로 잠겼지만, 런타임 frontend remote adapter는 아직 Colyseus 우선이다. 구현 작업에서 필요한 변경:

- `VITE_REALTIME_MODE=remote`일 때 Socket.IO client adapter 사용.
- `VITE_REALTIME_MODE=local`일 때만 BroadcastChannel/local transport 허용.
- remote failure 시 BroadcastChannel 자동 fallback 금지.
- UI/feature는 transport를 직접 import하지 않고 store/controller action만 호출.

## 6. 일반 에셋 제출 후 Studio 유지

### 계약 상태

- `docs/frontend-v2/decisions/product-decisions.md` `DECISION-V2-005`: 일반 에셋 생성 후 Asset Studio에 머문다. 성공 toast와 "창고에서 진행 상황 보기" CTA를 표시한다. canvas/form은 유지하고 새 에셋 만들기에서만 초기화한다.
- `docs/frontend-v2/contracts/screen-state-matrix.md` `B_ASSET_STUDIO`:
  - exit condition: successful non-avatar submit stays on screen.
  - success: success toast, job visible via warehouse CTA, form/canvas preserved.

### 코드 근거: 현재는 Warehouse로 이동

- `client/src/App.tsx` `AssetStudio.handleSubmit`은 `submitAsset({ category, ... })`만 호출한다.
- `client/src/store/appStore.ts` `submitAsset`은 결과 저장 후 다음 상태를 설정한다.

```ts
view: payload.category === 'avatar' ? 'main' : 'warehouse',
warehouseTab: payload.category === 'avatar' ? state.warehouseTab : 'component',
studioSourceAssetId: null,
```

따라서 non-avatar 일반 에셋 제출 후 현재 런타임은 `warehouse`로 이동한다.

### 추가로 없는 것

- 일반 에셋 submit success toast queue가 확인되지 않는다.
- "창고에서 진행 상황 보기" CTA가 확인되지 않는다.
- submit 후 canvas/form 보존 정책이 구현되어 있지 않다. 현재는 화면 이동으로 Studio state가 사실상 해제된다.

### 판정

NOT IMPLEMENTED다.

구현 작업에서 필요한 변경:

- avatar submit은 기존처럼 Main 이동 유지.
- non-avatar submit은 `view: 'studio'` 유지.
- created asset/job을 assets list에 추가하되 `studioSourceAssetId`와 local form/canvas를 초기화하지 않는다.
- toast system 또는 Studio-local success notice에 warehouse CTA를 추가한다.
- "새 에셋 만들기" action에서만 canvas/form/source state를 초기화한다.

## 7. 최종 판정

| 항목 | 최종 판정 | 구현 전 필수 조치 |
|---|---|---|
| 768x1536 workspace buffer | PASS | V2 DrawingEngine 테스트 추가 |
| 24x10 cells / 32px snap | PASS | Race projection과 editor snap 용어 계속 분리 |
| item은 system-only | PASS | 완료: backend/API에서 user-generated item 차단, system item seed 보존 |
| remote realtime은 Socket.IO 우선 | NOT IMPLEMENTED | frontend realtime adapter를 Socket.IO remote mode로 전환 |
| 일반 에셋 제출 후 Studio 유지 | NOT IMPLEMENTED | `submitAsset`/Studio success flow 수정 및 toast CTA 추가 |

## 8. 검증 명령

이번 작업은 문서 감사 보고서 작성만 수행했다.

실행한 확인:

- `git status --short --branch`
- `git status --short --untracked-files=all`
- `git diff --check`
- `git diff --name-only -- client/src backend server shared package.json package-lock.json pnpm-lock.yaml yarn.lock client/package.json backend/package.json server/package.json shared/package.json`
- `rg`로 결정 문서와 관련 코드 symbol 검색
- 관련 파일 `sed` read

결과:

- `git diff --check`: 문제 없음.
- runtime/package tracked diff: 없음.
- 신규 작성 파일: `docs/frontend-v2/reports/01-five-decision-implementation-audit.md`

아직 실행하지 않은 것:

- `npm run lint --workspace client -- --quiet`
- `npm run smoke --workspace client`
- `npm run build --workspace client`

이 보고서는 런타임 변경이 없으므로 build 검증은 수행하지 않았다.
