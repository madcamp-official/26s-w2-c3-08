# Frontend V2 Final Plan

이 문서는 첨부 텍스트, `docs/` 문서, 그리고 현재 서비스 디렉터리(`client/`, `backend/`, `server/`, `shared/`, `gpu-worker/`, `qwen-prompt-server/`)를 기준으로 정리한 프론트엔드 최종 재구축 계획이다.

핵심 결정은 명확하다. 현재 UI를 예쁘게 리스킨하지 않는다. 기존 React 화면과 CSS는 최종 산출물에서 제거하고, 새 UI 시스템을 처음부터 만든 뒤 현재 동작 로직과 서비스 계약에 연결한다.

## 1. 최종 목표

### 1.1 목표 문장

새 프론트엔드는 `Multiplayer AI Relay Map Maker`의 로그인, 메인, 창고, 설정, 아바타 생성, 에셋 스튜디오, 로비, 방 대기실, 맵 제작, 검증, 레이스, 결과 화면을 하나의 일관된 제품 UI로 다시 구축한다.

### 1.2 성공 기준

- 기존 `client/src/App.tsx` 중심 UI 구조를 제거한다.
- 기존 `client/src/App.css` 중심 스타일을 제거한다.
- 화면 JSX와 스타일을 재사용하지 않고 새 컴포넌트 체계로 재작성한다.
- 기존 게임 로직, Phaser 캔버스, Mock API, remote API adapter, realtime adapter는 필요한 범위에서 보존하거나 정리해 연결한다.
- 화면별 필수 상태를 모두 구현한다.
- `npm run lint --workspace client -- --quiet`, `npm run smoke --workspace client`, `npm run build --workspace client`, `git diff --check`를 통과한다.
- 1440x900, 1280x720, 1920x1080에서 주요 화면이 깨지지 않는다.
- 새 UI가 기본 경로가 된 뒤 오래된 UI 파일과 미사용 자산을 삭제한다.

## 2. 검토한 근거

### 2.1 첨부 텍스트의 핵심

첨부 텍스트의 핵심은 다음이다.

- 화면 이미지를 생성하고 벡터화해서 코드로 옮기는 방식은 이 서비스에 맞지 않는다.
- 이 서비스는 비동기 생성 상태, 제작 도구, Phaser 캔버스, 긴 게임 플로우, React 상태 UI가 섞여 있다.
- UI 원본은 이미지가 아니라 디자인 토큰, 네이티브 컴포넌트, 화면 상태 계약, React 컴포넌트여야 한다.
- 현재 구현은 동작 참고 자료로 보고, 확정 사양은 `screen-design.md`를 우선한다.
- Phaser 게임 로직은 최대한 보존하고 React UI와 HUD를 새로 만든다.
- 아바타/에셋 스튜디오는 단순 CSS 변경으로 해결할 수 없으며 드로잉 엔진과 화면 UI를 분리해야 한다.
- Codia, 이미지 생성, Figma AI는 보조 도구로만 쓰고 최종 UI 컴포넌트의 원본으로 쓰지 않는다.

### 2.2 문서 기준

우선순위는 다음 순서로 둔다.

1. `docs/KJH/screen-design.md`
   - S1 로그인, S2 메인, S2b 내 창고, S2c 설정, A 아바타 생성, B 에셋 스튜디오의 제품 사양 기준.
2. `docs/KJH/asset-attributes.md`
   - 에셋 스튜디오 속성 폼과 조건부 비활성의 기준.
3. `docs/KJH/player-spec.md`
   - 아바타 규격, 히트박스, 액션 상태, 게임 HUD에서 표시할 플레이어 상태의 기준.
4. `docs/KJH/ai-pipeline.md`
   - 생성 상태, sprite action, queued/generating/ready/failed 흐름의 기준.
5. `docs/LSJ/plan.md`
   - S3 이후 로비, 방, 제작, 검증, 병합, 레이스, 결과의 MVP 플로우 기준.
6. `docs/LSJ/backend.md`
   - REST/Socket.IO 백엔드 계약의 참고.
7. `docs/KJH/architecture.md`, `docs/KJH/tech-stack.md`
   - Colyseus, shared package, 서버 권위 방향의 참고.
8. 현재 코드
   - 작동하는 MVP 흐름과 Phaser/Mock/realtime 연결의 참고.

## 3. 현재 구현 상태 요약

### 3.1 현재 프론트 구조

현재 프론트는 `client/` 워크스페이스에 있다.

- Vite + React + TypeScript
- Phaser 캔버스
- Zustand store
- Colyseus SDK + BroadcastChannel fallback
- Mock API + optional remote REST

주요 파일은 다음이다.

| 파일 | 현재 역할 | V2 처리 |
|---|---|---|
| `client/src/App.tsx` | 거의 모든 화면, 스튜디오, 창고, 로비, 방 페이즈 UI가 들어 있음 | 최종 삭제. 새 `app/`, `screens/`, `ui/`, `features/` 구조로 대체 |
| `client/src/App.css` | 전체 화면 스타일이 한 파일에 집중됨 | 최종 삭제. `styles/tokens.css`, 컴포넌트별 CSS module 또는 전역 레이어로 대체 |
| `client/src/components/AvatarCreator.tsx` | 과거 400x400 `react-sketch-canvas` 아바타 컴포넌트 | 삭제 후보. 현재 V2 사양과 불일치 |
| `client/src/game/MapEditorCanvas.tsx` | Phaser 맵 에디터 | 보존. React HUD 연결부만 정리 |
| `client/src/game/PlaytestCanvas.tsx` | 검증/테스트 캔버스 | 보존 |
| `client/src/game/RaceCanvas.tsx` | 레이스 캔버스 | 보존 |
| `client/src/game/assetRules.ts` | 에셋 동작 규칙 | 보존하되 shared schema와 정합성 검토 |
| `client/src/net/api.ts` | Mock/remote REST adapter | 보존하되 contract 정리 |
| `client/src/net/realtime.ts` | Colyseus/local realtime adapter | 보존하되 screen dependency 제거 |
| `client/src/store/appStore.ts` | 앱 상태와 action | 보존하되 slice 분리 |
| `client/src/types/domain.ts` | 프론트 domain type | 보존하되 backend/shared와 정합성 갱신 |

### 3.2 현재 구현의 장점

- Mock 모드로 전체 게임 루프가 작동한다.
- 로그인, 메인, 창고, 스튜디오, 로비, 방, 제작, 검증, 병합, 레이스, 결과가 하나의 흐름으로 이어진다.
- Phaser 캔버스 세 개가 MVP 게임 루프를 이미 담당한다.
- `client/src/net/api.ts`가 remote API와 Mock API를 분리한다.
- `client/src/net/realtime.ts`가 Colyseus와 BroadcastChannel fallback을 분리한다.
- `client/src/store/appStore.ts`가 UI가 사용할 action을 이미 제공한다.

### 3.3 현재 구현의 문제

- `App.tsx`가 5천 줄 이상이고 화면, 비즈니스 로직, drawing UI, Phaser HUD, 유틸 함수가 섞여 있다.
- `App.css`가 2천 줄 이상이고 화면별 스타일 충돌 위험이 크다.
- 새 Figma/디자인 시스템과 1:1로 연결할 컴포넌트 단위가 부족하다.
- 화면별 상태를 재사용 가능한 component variant로 표현하지 못한다.
- API path 충돌이 있다.
  - 문서: `POST /assets`
  - 현재 frontend/backend: `/api/assets/generate`
  - frontend adapter 후보: `/api/assets/avatar/generate`
- 실시간 문서도 세대가 섞여 있다.
  - KJH: Colyseus/서버 권위 지향
  - LSJ backend: Socket.IO 지향
  - 현재 frontend: Colyseus SDK + BroadcastChannel fallback
  - 현재 `backend/`: Socket.IO
  - 현재 `server/`: Colyseus scaffold 수준
- `shared/schemas`와 `shared/physics`가 아직 TODO 스텁이라 프론트가 많은 규칙을 로컬에 들고 있다.

## 4. 제품 결정 사항

이 섹션은 V2에서 흔들리지 않도록 정한 결정이다.

### 4.1 화면 사양 우선순위

- S1, S2, S2b, S2c, A, B는 `docs/KJH/screen-design.md`의 확정 사양을 기준으로 하이파이를 만든다.
- S3, C, S4, D, E, F는 현재 구현과 `docs/LSJ/plan.md`를 기준으로 먼저 화면 계약을 확정하고 하이파이로 올린다.
- 현재 구현은 동작 참고 자료다. 현재 UI 모양은 재사용하지 않는다.

### 4.2 아바타 캔버스

- 편집 해상도: 256x512.
- 논리 비율: 1x2 타일.
- 제출 이미지: 보이는 256x512 영역만 crop.
- 내부 작업 버퍼: `3x3` 기준으로 768x1536으로 확정한다.
- `screen-design.md`의 "3x3배, 768x1024"는 계산상 충돌하므로 V2에서는 768x1536으로 맞춘다.
- 가이드 실루엣은 제거한다.
- 체커와 격자는 표시 전용 overlay이며 export와 eyedropper 대상에서 제외한다.

### 4.3 에셋 스튜디오 생성 후 동작

일반 에셋은 `[만들기]` 후 스튜디오에 남는다.

- 성공 토스트: "에셋 생성을 요청했어요."
- 보조 CTA: "창고에서 진행 상황 보기"
- 현재 캔버스와 속성은 유지한다.
- 같은 내용을 바로 재제출하지 못하도록 dirty/hash 상태를 둔다.
- `[새 에셋 만들기]`를 눌렀을 때만 캔버스와 폼을 초기화한다.

아바타는 문서대로 `[생성하기]` 후 메인으로 돌아간다.

### 4.4 창고 카테고리

- 창고의 컴포넌트 에셋 필터는 플랫폼, 장애물, 몬스터, 배경만 노출한다.
- 아이템은 시스템 제공 고정 파츠로 보고 일반 유저 제작 대상에서 제외한다.
- 맵 에디터에서는 시스템 아이템이 필요할 경우 시스템 에셋 목록에서만 노출한다.

### 4.5 맵 크기와 그리드

- 현재 MVP의 편집 보드는 24x10 셀로 유지한다.
- 문서의 32x32는 "픽셀 스냅 그리드" 또는 향후 월드 제한으로 분리해서 명시한다.
- V2 화면 표기는 "24x10 제작 보드, 32px 스냅"으로 시작한다.
- 향후 전체 월드를 32x32 셀로 확장하려면 Phaser renderer와 map segment schema를 먼저 바꾼다.

### 4.6 실시간 계층

화면은 Colyseus, Socket.IO, BroadcastChannel 중 특정 구현에 직접 의존하지 않는다.

V2 화면은 `RealtimeService`가 제공하는 다음 추상 이벤트만 본다.

- `roomJoined`
- `roomStateChanged`
- `phaseChanged`
- `timerTick`
- `timeVoteUpdated`
- `segmentSubmitted`
- `validationResult`
- `mapMerged`
- `racePosition`
- `raceFinished`
- `resultsFinal`
- `assetJobUpdated`
- `roomsChanged`

현재 구현은 `client/src/net/realtime.ts`를 유지하되, 화면에서는 store action만 호출한다.

### 4.7 API 계층

화면은 `/api/...` path를 직접 알면 안 된다.

V2 화면이 사용할 API action은 다음으로 고정한다.

- `createSession`
- `getStoredSession`
- `saveStoredSession`
- `listAssets`
- `createAsset`
- `requestSpriteRegeneration`
- `createDeviceLinkCode`
- `consumeDeviceLinkCode`
- `listRooms`
- `createRoom`
- `joinRoom`
- `joinPublicRoom`
- `saveMapSegment`
- `validateMapSegment`
- `mergeRoomMap`

API path는 `client/src/net/api.ts` 안에서만 결정한다. 백엔드 최종 계약이 `POST /assets`로 바뀌어도 화면 코드는 바뀌지 않아야 한다.

## 5. V2 UX 구조

서비스 전체를 하나의 레이아웃으로 보지 않는다. 세 가지 shell로 나눈다.

### 5.1 Launcher Shell

대상 화면:

- S1 로그인
- S2 메인
- S2b 내 창고
- S2c 설정
- S3 로비
- C 방 대기실

특징:

- 밝은 sky background.
- 노란 title band.
- 흰색 또는 밝은 panel.
- 큰 CTA.
- 낮은 정보 밀도.
- 게임 런처처럼 빠르게 진입하는 구조.

### 5.2 Studio Shell

대상 화면:

- A 아바타 생성
- B 에셋 스튜디오

특징:

- 작업 효율 우선.
- 중앙 canvas는 무채색.
- 좌우 panel은 높은 정보 밀도.
- 접기, 리사이즈, scroll, disabled, dirty state가 핵심.
- 장식보다 도구 상태와 조작 피드백을 우선한다.

### 5.3 Game Shell

대상 화면:

- S4 맵 제작
- D 검증
- E 레이스
- F 결과

특징:

- Phaser canvas가 주 콘텐츠.
- React는 HUD, side panel, overlay를 담당.
- 게임 시야를 가리지 않는 panel.
- timer, budget, rank, penalty, validation state를 빠르게 읽을 수 있어야 한다.
- Phaser scene 자체를 Figma 벡터로 재현하지 않는다.

## 6. 디자인 시스템 계획

### 6.1 스타일 원칙

- 두꺼운 검정 픽셀 테두리를 쓰지 않는다.
- 원색 단색 대면적을 피한다.
- 노란 버튼의 텍스트는 흰색이 아니라 어두운 텍스트를 쓴다.
- sky blue 위 작은 흰색 텍스트는 피한다.
- 본문, 버튼, 폼은 Pretendard 계열.
- title, timer, 큰 숫자만 Galmuri 계열.
- UI 컴포넌트는 이미지가 아니라 HTML/CSS와 React component로 만든다.
- 배경 일러스트, 샘플 에셋, 장식 이미지만 bitmap asset을 쓴다.
- 텍스트는 이미지에 넣지 않는다.

### 6.2 tokens

새 파일:

- `client/src/styles/tokens.css`
- `client/src/styles/globals.css`
- `client/src/styles/reset.css`
- `client/src/styles/accessibility.css`

필수 토큰:

```css
:root {
  --color-yellow-500: #f6be00;
  --color-sky-500: #4a9de0;
  --color-red-500: #e52521;
  --color-green-500: #43a047;
  --color-brown-500: #8b5a2b;

  --color-bg-app-top: #6cb7ef;
  --color-bg-app-bottom: #d8f0ff;
  --color-bg-panel: #ffffff;
  --color-bg-panel-muted: #f6f8fb;
  --color-text-primary: #111827;
  --color-text-secondary: #4b5563;
  --color-text-on-yellow: #111827;
  --color-border-default: rgba(17, 24, 39, 0.14);
  --color-border-focus: #1d4ed8;
  --color-status-queued: #6b7280;
  --color-status-generating: #2563eb;
  --color-status-success: #15803d;
  --color-status-error: #dc2626;

  --color-canvas-checker-a-light: #d4d4d4;
  --color-canvas-checker-b-light: #bfbfbf;
  --color-canvas-grid-major: #808080;
  --color-canvas-grid-minor: #a6a6a6;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 999px;
}
```

실제 색상은 contrast check 후 조정한다. 토큰 이름은 화면 구현에서 직접 hex를 쓰지 않게 만드는 것이 목적이다.

### 6.3 core components

새 컴포넌트:

| 컴포넌트 | 필수 props/state |
|---|---|
| `Button` | `variant`, `size`, `loading`, `disabled`, `icon`, `fullWidth` |
| `IconButton` | `icon`, `size`, `pressed`, `disabled`, accessible label |
| `TextField` | label, value, error, helper, disabled |
| `TextArea` | label, value, error, helper, disabled |
| `SegmentedControl` | options, selected, disabled |
| `Tabs` | selected, disabled tab, badge |
| `FilterChip` | selected, count |
| `Badge` | queued, generating, ready, failed, danger |
| `ProgressBar` | value, indeterminate |
| `Modal` | title, size, footer, dismissible, ESC close |
| `Toast` | info, success, error |
| `Slider` | value, muted, disabled |
| `Toggle` | checked, disabled |
| `Tooltip` | placement, content |
| `EmptyState` | title, action |

아이콘은 `lucide-react` 추가를 권장한다. 텍스트가 들어간 둥근 도형으로 도구 버튼을 대체하지 않고, 가능한 경우 아이콘 버튼과 tooltip을 쓴다.

### 6.4 product components

| 컴포넌트 | 필수 상태 |
|---|---|
| `LauncherShell` | default, loading |
| `TitleBand` | default, compact |
| `AvatarPanel` | system, generating, ready, failed |
| `AssetCard` | queued, generating, ready, failed, selected, disabled |
| `AssetPreview` | static, animated, unavailable |
| `AssetReviewModal` | action tabs, cooldown, working, locked |
| `CooldownButton` | available, coolingDown, working |
| `RoomCard` | open, private, full, playing, disabled |
| `PlayerSlot` | empty, joined, ready, host |
| `DeviceLinkCode` | idle, issued, expired, invalid |
| `HUDTimer` | normal, warning, danger, overtime |
| `BudgetMeter` | normal, warning, exceeded |
| `ResultsRow` | finished, unfinished, localPlayer, winner |

### 6.5 studio components

| 컴포넌트 | 필수 상태 |
|---|---|
| `StudioShell` | left collapsed, right collapsed, resizing |
| `StudioPanel` | left, right, expanded, collapsed |
| `PanelResizeHandle` | hover, dragging, disabled |
| `DrawingToolbar` | pen, eraser, eyedropper, move |
| `ToolButton` | active, disabled |
| `BrushSizeControl` | 2, 4, 8, custom |
| `PaletteGrid` | selected, recent, opacity |
| `PaletteSwatch` | selected, transparent |
| `DrawingViewport` | checker light/dark, grid on/off, outside dim |
| `AttributeField` | radio, checkbox, select, disabled |
| `AssetLoadModal` | mine, others, empty, loading |
| `DirtyStateNotice` | unchanged, changed, submitted |

## 7. 새 코드 구조

V2 목표 구조:

```text
client/src/
  app/
    App.tsx
    AppProviders.tsx
    routes.tsx
    shells/
      LauncherShell.tsx
      StudioShell.tsx
      GameShell.tsx
    screens/
      LoginScreen.tsx
      MainScreen.tsx
      WarehouseScreen.tsx
      LobbyScreen.tsx
      RoomScreen.tsx
      SettingsModal.tsx
  features/
    assets/
      AssetCard.tsx
      AssetPreview.tsx
      AssetReviewModal.tsx
      assetViewModel.ts
    studio/
      AvatarStudioScreen.tsx
      AssetStudioScreen.tsx
      drawing/
        DrawingEngine.ts
        DrawingViewport.tsx
        DrawingToolbar.tsx
        PaletteGrid.tsx
        exportDrawing.ts
      attributes/
        AttributeForm.tsx
        attributeSchema.ts
    lobby/
      RoomCard.tsx
      CreateRoomPanel.tsx
      PlayerSlot.tsx
    game-ui/
      MapBuildScreen.tsx
      ValidationScreen.tsx
      MergingScreen.tsx
      RaceScreen.tsx
      ResultsScreen.tsx
      HUDTimer.tsx
      BudgetMeter.tsx
  ui/
    Button/
    IconButton/
    Modal/
    Tabs/
    Field/
    Badge/
    ProgressBar/
    Toast/
    Tooltip/
  styles/
    reset.css
    tokens.css
    globals.css
    accessibility.css
  game/
    MapEditorCanvas.tsx
    PlaytestCanvas.tsx
    RaceCanvas.tsx
    assetRules.ts
  net/
    api.ts
    realtime.ts
  store/
    appStore.ts
    slices/
      sessionSlice.ts
      assetSlice.ts
      roomSlice.ts
      gameSlice.ts
      settingsSlice.ts
  types/
    domain.ts
```

전환 중에는 `App.tsx`를 바로 삭제하지 않고 `client/src/app/App.tsx`를 먼저 만든다. 새 root가 안정화되면 기존 `client/src/App.tsx`, `client/src/App.css`, `client/src/components/AvatarCreator.tsx`를 삭제한다.

## 8. Drawing Engine 계획

현재 `SketchBoard`는 UI, panel resize, palette, export, crop, eyedropper, move, upload block을 모두 한 컴포넌트에서 처리한다. V2에서는 아래처럼 나눈다.

```text
DrawingEngine
  state
    logicalCanvas
    workspaceBuffer
    activeTool
    brush
    opacity
    paths
    history
    translate
  commands
    draw
    erase
    sampleColor
    moveAll
    undo
    redo
    clear
    resizeAndResample
    cropVisibleArea
    exportPng
```

### 8.1 드로잉 구현 선택

1차 V2에서는 현재 작동 안정성을 위해 `react-sketch-canvas`를 내부 adapter로 유지할 수 있다. 단, 화면 컴포넌트가 직접 `ReactSketchCanvas`에 의존하지 않게 한다.

2차 V2에서는 필요하면 Canvas 2D 기반 자체 엔진으로 전환한다.

### 8.2 필수 기능

- 256x512 아바타 canvas.
- n x m 에셋 canvas.
- 3x3 작업 버퍼.
- 보이는 영역 crop export.
- light/dark checker.
- major/minor grid overlay.
- pen, eraser, eyedropper, move all.
- brush size.
- opacity.
- recent colors.
- undo/redo.
- clear all.
- paste/drop image 차단.
- dirty state.
- loaded asset 수정 없으면 저장 불가.

## 9. 화면별 V2 계획

### 9.1 S1 LoginScreen

필수 상태:

- 기본
- 닉네임 빈 값
- 12자 초과
- 제출 중
- 서버 오류
- token 검증 중

연결:

- `useAppStore.login`
- `getStoredSession`
- boot 후 session이 있으면 main으로 이동

완료 기준:

- localStorage session 복원.
- remote API가 꺼져도 Mock session 생성.
- enter key submit.
- error message가 layout을 밀지 않음.

### 9.2 S2 MainScreen

필수 상태:

- 기본 아바타
- 아바타 생성 중
- 아바타 ready
- 아바타 failed
- asset generation toast
- settings modal open

구성:

- 좌측 또는 상단 avatar panel.
- primary CTA: 게임하기.
- secondary CTA: 에셋 만들기, 내 창고.
- settings icon button.
- background는 bitmap/WebP 또는 CSS gradient + tile overlay.

연결:

- `navigate('lobby')`
- `navigate('studio')`
- `openWarehouse('avatar' | 'component')`
- `setSettingsOpen(true)`

### 9.3 S2b WarehouseScreen

필수 상태:

- 빈 상태
- avatar tab
- component tab
- category filter
- queued card
- generating card
- ready card
- failed card
- detail modal
- cooldown
- retry working

구성:

- 큰 탭: 아바타 / 컴포넌트 에셋.
- 컴포넌트 필터: 전체, 플랫폼, 장애물, 몬스터, 배경.
- summary: 내가 만든 에셋, 사용 가능, 작업 중, 실패.
- grid.
- `AssetReviewModal`.

연결:

- `assets`
- `equipAvatar`
- `requestSpriteRegeneration`
- `openStudioWithAsset`
- `navigate('avatar' | 'studio')`

### 9.4 S2c SettingsModal

필수 상태:

- 기본
- 볼륨 변경
- 음소거
- 닉네임 변경
- 연동 코드 발급
- 코드 만료
- 잘못된 코드
- 코드로 session 불러오기

연결:

- `settings`
- `updateSettings`
- `updateNickname`
- `issueDeviceLinkCode`
- `loadSessionByDeviceCode`

### 9.5 A AvatarStudioScreen

필수 상태:

- 빈 canvas
- drawing
- tool selected
- light/dark checker
- loaded avatar, unchanged
- loaded avatar, changed
- submitting
- submit error
- my avatar list empty/non-empty

구성:

- `StudioShell`
- left panel: drawing tools, palette, my avatars.
- center: `DrawingViewport`.
- bottom or right submit panel: name, optional description, submit.

연결:

- `submitAsset({ category: 'avatar' })`
- `equipAvatar`
- `openStudioWithAsset`
- 제출 성공 후 `navigate('main')`

### 9.6 B AssetStudioScreen

필수 상태:

- 기본
- left collapsed
- right collapsed
- panel resizing
- size changed and resampled
- asset load modal mine
- asset load modal others
- loaded asset unchanged blocked
- loaded asset changed
- invalid missing name
- submit success toast
- submit failed

구성:

- left panel: drawing tools, palette, asset load button.
- center: canvas.
- right panel: category, size, attrs, description.
- toast + warehouse CTA.

연결:

- `submitAsset({ category, attrs, widthCells, heightCells })`
- `openWarehouse('component')`
- `assets`

### 9.7 S3 LobbyScreen

필수 상태:

- room list loading
- empty room list
- public room open
- private room open
- full room disabled
- playing room disabled with elapsed time
- create room public
- create room private
- password error
- quick join no room

연결:

- `refreshRooms`
- `createRoom`
- `enterRoom`
- `enterPublicRoom`

### 9.8 C RoomScreen Lobby Phase

필수 상태:

- host
- non-host
- empty slot
- joined slot
- ready
- not ready
- not enough players
- mock demo override
- realtime connected/local/offline

연결:

- `toggleLobbyReady`
- `advanceRoomPhase`
- `leaveRoom`
- `roomPlayers`
- `realtimeStatus`

### 9.9 S4 MapBuildScreen

필수 상태:

- normal editing
- asset shelf collapsed
- tool dock collapsed
- selected asset
- selected placement
- placement denied: overlap
- placement denied: budget
- placement denied: endpoint
- endpoint height invalid
- build locked
- time vote idle
- time vote pending
- time vote applied
- build test modal
- submit pending
- submit complete

연결:

- `MapEditorCanvas` preserved.
- React HUD and side panels rewritten.
- `submitMapSegment`
- `requestTimeVote`
- `phaseRemainingMs`
- `roomPlayers`

### 9.10 D ValidationScreen

필수 상태:

- no segment
- playing
- cleared
- failed recorded
- all players waiting
- timeout

연결:

- `PlaytestCanvas` preserved.
- `validateCurrentSegment`
- `phaseRemainingMs`
- `roomPlayers`

### 9.11 MergingScreen

필수 상태:

- merging
- validated segments present
- fallback segment
- merge error

연결:

- `mergeCurrentRoomMap`
- `mergedMap`
- `mapSegments`

### 9.12 E RaceScreen

필수 상태:

- normal
- local freeze penalty
- overtime
- player finished
- no merged map fallback
- race position updates
- finish

연결:

- `RaceCanvas` preserved.
- `broadcastRacePosition`
- `recordRaceFinish`
- `updateRaceProgress`
- `phaseRemainingMs`
- `isRaceOvertime`

### 9.13 F ResultsScreen

필수 상태:

- all finished
- some unfinished
- winner
- local player highlight
- validation penalty
- leave room

연결:

- `roomPlayers`
- `leaveRoom`

## 10. 서비스 연결 계획

### 10.1 Store 정리

현재 `appStore.ts`는 유지하되 다음 slice로 나눈다.

- `sessionSlice`
- `assetSlice`
- `roomSlice`
- `gameSlice`
- `settingsSlice`

화면은 API 함수를 직접 호출하지 않고 store action만 호출한다.

### 10.2 API adapter 정리

현재 `client/src/net/api.ts`를 유지하면서 다음을 정리한다.

- response unwrap 로직을 하나로 통일한다.
- `POST /api/assets/avatar/generate` fallback 후보를 명시적으로 정리한다.
- V2 화면에는 `createAsset`만 노출한다.
- backend가 `POST /assets`로 바뀔 경우 adapter 내부에서만 path를 교체한다.
- remote API 실패 시 Mock fallback을 유지한다.
- `AssetStatus`와 `AssetSprite.status`를 모두 queued/generating/ready/failed로 정규화한다.

### 10.3 Realtime adapter 정리

현재 `client/src/net/realtime.ts`를 유지하면서 다음을 정리한다.

- 화면에서 realtime 함수 직접 import 금지.
- store action만 realtime 함수 호출.
- Colyseus, Socket.IO, BroadcastChannel 구현은 adapter 내부 세부사항으로 격리.
- V2 화면은 `realtimeStatus`를 badge로만 표현.

### 10.4 shared 패키지 연결

`shared/`는 V2에서 더 중요해진다.

우선 작업:

- `shared/constants.ts`의 `AVATAR_CANVAS`를 프론트 상수와 일치시킨다.
- `shared/constants.ts`에 editor board, placement budget, regen cooldown을 추가한다.
- `shared/schemas/index.ts`에 asset attrs zod schema를 채운다.
- `client/src/features/studio/attributes`는 shared schema를 import한다.

## 11. 기존 UI 제거 전략

### 11.1 원칙

기존 UI를 수정해서 V2로 만들지 않는다. 새 UI를 별도 구조에 만든 다음 root를 교체한다.

### 11.2 제거 대상

최종 삭제 대상:

- `client/src/App.tsx`
- `client/src/App.css`
- `client/src/components/AvatarCreator.tsx`
- `client/public/guide-silhouette.png`
- Vite/React 기본 asset 중 미사용 파일
  - `client/src/assets/react.svg`
  - `client/src/assets/vite.svg`

보존 대상:

- `client/src/game/MapEditorCanvas.tsx`
- `client/src/game/PlaytestCanvas.tsx`
- `client/src/game/RaceCanvas.tsx`
- `client/src/game/assetRules.ts`
- `client/src/net/api.ts`
- `client/src/net/realtime.ts`
- `client/src/store/appStore.ts` 또는 분리된 slice 파일
- `client/src/types/domain.ts`

### 11.3 전환 순서

1. 새 `client/src/app/App.tsx`와 `client/src/styles/*`를 만든다.
2. `client/src/main.tsx`가 새 App을 import하도록 바꾼다.
3. 오래된 `App.tsx`는 잠시 `LegacyApp.tsx`로 이동하지 않는다. 이동하면 diff가 커지므로 새 App이 안정화될 때까지 그대로 둔다.
4. 화면별 parity를 확인한다.
5. 새 UI가 전체 흐름을 완료하면 기존 `App.tsx`, `App.css`, `AvatarCreator.tsx`, guide silhouette를 삭제한다.
6. `rg "App.css|guide-silhouette|Legacy|old-ui"`로 잔여 참조를 검사한다.

## 12. Figma 및 디자인 산출물 계획

Figma를 사용할 경우 다음 순서로 진행한다.

1. 현재 UI 캡처는 `90_Current UI Reference`에만 둔다.
2. AI/Codia import는 `91_AI Imports`에만 둔다.
3. `01_Foundations`에 variables, text styles, effect styles를 만든다.
4. `02_Core Components`에 core components를 만든다.
5. `03_Studio Components`에 studio tool components를 만든다.
6. `04_Game Components`에 HUD, room, result components를 만든다.
7. `10_Launcher Screens`에 S1, S2, S2b, S2c, S3, C를 만든다.
8. `11_Studio Screens`에 A, B를 만든다.
9. `12_Game Screens`에 S4, D, E, F를 만든다.
10. `20_Prototype`에 주요 플로우를 연결한다.

Code Connect가 가능하면 `Button`, `AssetCard`, `StudioPanel`, `RoomCard`, `HUDTimer`부터 연결한다. 불가능하면 `docs/design/component-map.md`와 `docs/design/screen-node-map.md`를 만든다.

## 13. 구현 wave

### Wave 0. 계약 정리

산출물:

- `frontend.md`
- screen state matrix
- API action matrix
- realtime event matrix

완료 조건:

- 문서/구현 충돌에 대한 V2 결정이 기록된다.

### Wave 1. 공통 기반

작업:

- tokens.css
- reset/globals/accessibility
- Button
- IconButton
- Field
- Modal
- Tabs
- Badge
- ProgressBar
- Toast
- Shell components

완료 조건:

- Story/demo 또는 임시 screen에서 모든 core component 상태 확인.
- hardcoded hex 최소화.

### Wave 2. Launcher

작업:

- LoginScreen
- MainScreen
- WarehouseScreen
- SettingsModal

완료 조건:

- 로그인, session 복원, 창고 상태, 설정 연동 코드가 동작.
- S1~S2c 전체가 V2 UI로 보임.

### Wave 3. Studio

작업:

- DrawingEngine adapter
- DrawingViewport
- DrawingToolbar
- PaletteGrid
- AvatarStudioScreen
- AssetStudioScreen
- AssetLoadModal
- AttributeForm

완료 조건:

- 아바타 256x512 export.
- 에셋 n x m export.
- crop, move, eyedropper, dirty, paste/drop block 동작.
- 일반 에셋 생성 후 studio stay + toast.

### Wave 4. Lobby and Room

작업:

- LobbyScreen
- CreateRoomPanel
- RoomCard
- RoomScreen lobby phase
- PlayerSlot
- PhaseRail

완료 조건:

- 공개/비공개 방 생성/입장.
- ready/start.
- local realtime fallback 유지.

### Wave 5. Game HUD

작업:

- MapBuildScreen React HUD 재작성.
- ValidationScreen React HUD 재작성.
- MergingScreen.
- RaceScreen React HUD 재작성.
- ResultsScreen.

완료 조건:

- Phaser canvas는 유지하면서 React wrapper와 HUD만 V2가 됨.
- 제작, 검증, 병합, 레이스, 결과를 끝까지 완료.

### Wave 6. Legacy 제거

작업:

- `main.tsx`를 V2 App으로 고정.
- 기존 `App.tsx`, `App.css`, old AvatarCreator, guide silhouette 삭제.
- 미사용 class, asset, import 제거.
- smoke/build/lint.

완료 조건:

- 저장소에 오래된 UI 구현이 남아 있지 않음.
- 전체 MVP 플로우 통과.

## 14. 검증 계획

### 14.1 기능 검증

- session 저장과 복원.
- nickname validation.
- 아바타 미보유 기본 졸라맨.
- 아바타 generating/ready/failed.
- 에셋 queued/generating/ready/failed.
- failed retry.
- sprite action cooldown 5분.
- warehouse tab/filter/detail modal.
- settings volume/localStorage.
- device link issue/consume/expired/invalid.
- avatar studio export 256x512.
- asset studio export n x m.
- loaded asset unchanged submit block.
- panel width/collapse localStorage.
- lobby public/private/quick join.
- room ready/start.
- build placement overlap/budget/endpoint guard.
- build time vote.
- build submit lock.
- validation clear/fail.
- merge fallback.
- race freeze penalty.
- race overtime.
- results ranking.

### 14.2 시각 검증

뷰포트:

- 1280x720
- 1440x900
- 1920x1080

상태:

- 긴 닉네임.
- 긴 에셋 이름.
- 빈 목록.
- 최대 카드 수.
- modal open.
- panel collapsed.
- loading.
- error.
- Phaser canvas visible.

### 14.3 접근성 검증

- 모든 icon button에 accessible name.
- ESC로 modal 닫기.
- focus ring 명확.
- tab order 자연스러움.
- 색만으로 상태를 표현하지 않음.
- 노란 버튼은 어두운 텍스트.
- 최소 클릭 영역 40px 이상.
- timer/warning은 텍스트와 색을 함께 사용.

### 14.4 명령 검증

```bash
npm run lint --workspace client -- --quiet
npm run smoke --workspace client
npm run build --workspace client
git diff --check
```

가능하면 Playwright 기반 screenshot smoke를 추가한다.

## 15. 리스크와 대응

### 15.1 App.tsx 분해 리스크

리스크:

- 기존 UI와 로직이 강하게 섞여 있어 기능 회귀가 생기기 쉽다.

대응:

- UI를 바로 고치지 말고 store action과 view model부터 분리한다.
- 화면은 store action만 호출하게 만든다.
- Phaser 파일은 건드리지 않는다.

### 15.2 Drawing Engine 리스크

리스크:

- 스튜디오 기능은 단순 CSS 리스킨으로 해결되지 않는다.

대응:

- 1차는 `react-sketch-canvas` adapter로 안정성을 확보한다.
- 화면 UI와 DrawingEngine interface를 먼저 분리한다.
- 자체 canvas 엔진 전환은 2차 작업으로 둔다.

### 15.3 API 계약 충돌

리스크:

- 문서와 backend/frontend API path가 다르다.

대응:

- 화면은 API path를 모르도록 만든다.
- `client/src/net/api.ts`에 contract adapter를 둔다.
- backend 최종 path가 정해지면 adapter만 수정한다.

### 15.4 Realtime 계약 충돌

리스크:

- Colyseus, Socket.IO, BroadcastChannel이 혼재한다.

대응:

- UI는 realtime implementation에 직접 의존하지 않는다.
- store와 adapter 사이 event contract를 고정한다.
- 현재 demo 안정성을 위해 BroadcastChannel fallback은 유지한다.

### 15.5 디자인 과잉 리스크

리스크:

- Studio와 Game 화면이 Launcher처럼 장식적으로 변할 수 있다.

대응:

- Launcher, Studio, Game shell을 분리한다.
- Studio는 조작 밀도와 상태 가독성을 우선한다.
- Game은 Phaser canvas 가시성을 우선한다.

## 16. 최종 완료 정의

V2 완료는 다음 상태를 의미한다.

- 사용자가 새 UI에서 닉네임 로그인부터 결과 화면까지 한 판을 끝낼 수 있다.
- 기존 UI JSX/CSS는 삭제되어 있다.
- `App.tsx` 단일 거대 파일 구조가 없다.
- 공통 UI 컴포넌트가 tokens 기반으로 동작한다.
- 스튜디오 드로잉 UI가 화면과 엔진으로 분리되어 있다.
- Phaser 캔버스는 새 Game Shell 안에서 정상 표시된다.
- API/Realtime 구현은 화면과 분리되어 있다.
- Mock 모드와 remote API 모드가 모두 깨지지 않는다.
- 문서의 확정 화면 S1~B는 V2 하이파이 기준과 맞고, S3~F는 현재 MVP 동작 기준으로 화면 계약이 정리되어 있다.

## 17. 바로 다음 작업

1. `client/src/styles/tokens.css`와 core UI 컴포넌트를 만든다.
2. `client/src/app/App.tsx`와 세 shell을 만든다.
3. LoginScreen, MainScreen, WarehouseScreen, SettingsModal을 먼저 V2로 연결한다.
4. `client/src/App.tsx`에서 필요한 view model/helper만 새 파일로 옮기고 JSX/CSS는 재사용하지 않는다.
5. Studio DrawingEngine adapter를 만든다.
6. Phaser canvas는 보존한 채 Game HUD를 마지막 wave에서 교체한다.
7. 전체 플로우가 통과하면 legacy UI 파일을 삭제한다.
