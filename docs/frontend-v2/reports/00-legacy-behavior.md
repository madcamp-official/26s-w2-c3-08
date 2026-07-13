# Frontend V2 Phase 0 Legacy Behavior

작성일: 2026-07-13  
목적: 새 UI를 처음부터 만들기 전에 현재 UI의 실제 동작을 잃지 않도록 기록한다. 이 문서는 현재 UI 모양을 재사용하라는 뜻이 아니다.

## 1. 화면 모델과 전환

근거:

- `client/src/types/domain.ts` `AppView`
- `client/src/types/domain.ts` `RoomPhase`
- `client/src/App.tsx` `App`, `GameMakerApp`, `RoomFlow`

### 1.1 App-level 화면

| view | 렌더 symbol | 주요 진입 |
|---|---|---|
| `main` | `MainDashboard` | login 성공, brand button, avatar submit 후 |
| `avatar` | `AvatarStudio` | topnav, warehouse avatar CTA, `openStudioWithAsset` category avatar |
| `studio` | `AssetStudio` | topnav, main CTA, warehouse component CTA, non-avatar edit |
| `warehouse` | `Warehouse` | main/avatars panel, topnav, `openWarehouse` |
| `lobby` | `Lobby` | main `[게임하기]`, topnav, leave room |
| `room` | `RoomFlow` | create/join room |

### 1.2 Login boot

`App` behavior:

- mount 시 `boot()` 호출
- loading 중이고 session이 없으면 `app-loading`
- stored session이 없으면 `LoginScreen`
- login form은 nickname trim length 1-12만 허용
- `login(trimmedNickname)` 성공 후 `view: 'main'`
- session이 있으면 1초마다 `tickMockGeneration`, `tickRoomElapsed`

### 1.3 Topbar navigation

`GameMakerApp`:

- `Object.keys(viewLabels)`로 모든 `AppView` 버튼을 노출한다.
- navigation은 `navigate(targetView)`를 직접 호출한다.
- `navigate`는 `studioSourceAssetId`를 null로 만든다.
- settings는 `isSettingsOpen` boolean으로 overlay render한다.

## 2. 화면별 동작

### 2.1 `MainDashboard`

근거: `client/src/App.tsx` `MainDashboard`

- working/failed/equipped/latest/pending avatar를 `assets`에서 계산한다.
- CTA:
  - `게임하기` -> `navigate('lobby')`
  - `에셋 만들기` -> `navigate('studio')`
  - `내 창고` -> `openWarehouse('component')`
- avatar panel click -> `openWarehouse('avatar')`
- pending avatar가 있으면 progress label을 보여준다.
- failed avatar가 있으면 창고에서 retry 필요 메시지를 보여준다.

### 2.2 `AvatarStudio`

근거: `client/src/App.tsx` `AvatarStudio`, `SketchBoard`

- canvas visible size: `AVATAR_CANVAS = { width: 256, height: 512 }`
- submit payload:
  - `category: 'avatar'`
  - `attrs: { canvas: 'avatar-1x2' }`
  - `widthCells: null`, `heightCells: null`
  - `remixOfId` optional
- `submitAsset` store action은 avatar 제출 후 `view: 'main'`으로 바꾼다.
- side panel에는 name, description, manual `메인으로`, recent my avatars, equip/edit가 있다.
- loaded/remix asset은 수정 전 submit disabled다.

### 2.3 `AssetStudio`

근거: `client/src/App.tsx` `AssetStudio`, `attrGroupsByCategory`

- category 후보: `platform`, `obstacle`, `monster`, `background`
- `item`과 `avatar`는 일반 asset studio category에서 제외된다.
- width/height는 1-8 numeric input이며 canvas pixel size는 `widthCells * TILE_PX`, `heightCells * TILE_PX`
- submit payload:
  - `category`
  - `name`
  - `description`
  - `attrs: buildAssetAttrs(category, attrSelections)`
  - `widthCells`, `heightCells`
  - `remixOfId`
- `submitAsset` store action은 non-avatar 제출 후 현재 code 기준 `view: 'warehouse'`, `warehouseTab: 'component'`로 바꾼다.
- `AssetLoadModal`은 `mine` / `others` 탭이 있고 avatar/item/working asset을 제외한다.
- loaded/remix asset은 수정 전 submit disabled다.

### 2.4 `Warehouse`

근거: `client/src/App.tsx` `Warehouse`, `AssetReviewModal`, `AssetProgress`

- tab: `avatar`, `component`
- component filter: `all`, `platform`, `obstacle`, `monster`, `background`
- component tab은 `avatar`와 `item`을 제외한다.
- card click opens `AssetReviewModal`
- ready avatar는 `equipAvatar`
- failed asset은 `requestSpriteRegeneration` retry
- modal supports:
  - action tabs for multi-sprite assets
  - cooldown by `lastRegenAt` and `REGEN_COOLDOWN_MS`
  - edit via `openStudioWithAsset`
  - avatar equip

### 2.5 `SettingsModal`

근거: `client/src/App.tsx` `SettingsModal`, `client/src/store/appStore.ts`

- controlled by `isSettingsOpen`
- settings:
  - `bgmVolume`
  - `sfxVolume`
  - `bgmMuted`
  - `sfxMuted`
- nickname update is local/store/session update, not remote DB update.
- device link:
  - issue: `issueDeviceLinkCode`
  - consume: `loadSessionByDeviceCode`
  - code format comes from API/mock, placeholder `TIGER-3392`

### 2.6 `Lobby`

근거: `client/src/App.tsx` `Lobby`

- local create form: name, isPublic checkbox, optional password, maxPlayers 2/3/4.
- create room calls store `createRoom`; success moves to `view: 'room'`.
- quick join calls `enterPublicRoom`.
- room card select:
  - only if `room.phase === 'lobby' && room.players < room.maxPlayers`
  - public joins immediately
  - private opens password modal
- running/full rooms are visible but locked.
- elapsed display: `room.phase === 'lobby' ? '대기' : 경과 formatElapsed(room.elapsedSeconds)`

## 3. Room and Game Flow

근거: `client/src/App.tsx` `RoomFlow`

### 3.1 Phase switch

| phase | rendered symbol | completion trigger |
|---|---|---|
| `lobby` | `RoomLobbyPhase` | `advanceRoomPhase` via start button |
| `building` | `MapBuildPhase` | local timer expiry or all submitted -> `advanceRoomPhase` |
| `validating` | `ValidationPhase` | local timer expiry or all validation records -> `advanceRoomPhase` |
| `merging` | `MergingPhase` | `mergeCurrentRoomMap`, min 1400ms delay -> `advanceRoomPhase` |
| `racing` | `RacePhase` | all finished, race timer expiry, or result button -> `advanceRoomPhase` |
| `finished` | `ResultsPhase` | `leaveRoom` |

### 3.2 Lobby phase

`RoomLobbyPhase`:

- non-host local player can toggle ready.
- start enabled if:
  - local player is host or mock source allows control
  - all non-host players ready
  - real players >= 2 or mock demo room
- mock demo can use local helper players.

### 3.3 Building phase

`MapBuildPhase`:

- duration: local 180s unless `phaseRemainingMs` exists.
- board constants from `App.tsx`:
  - `EDITOR_BOARD = { cols: 24, rows: 10 }`
  - `BUILD_PLACEMENT_BUDGET = 40`
  - `MAX_ENDPOINT_VERTICAL_DELTA = 4`
- asset shelf:
  - source `system` / `mine`
  - categories include `platform`, `obstacle`, `monster`, `item`, `background`
  - ready assets only, avatar excluded
- placement checks:
  - locked state blocks edit
  - board bounds
  - no overlap with start/end
  - no overlap with other placements
  - budget check
- endpoint movement checks:
  - start/end cannot be same cell
  - cannot move onto placement
  - vertical delta <= 4
- local frequent asset bar is derived from usage count.
- time vote:
  - `+15s` / `-15s`
  - one use per local phase
  - remote via `requestTimeVote`
  - local fallback applies majority with mock helpers
- submit:
  - calls `submitMapSegment`
  - after submit, build is locked and player is marked ready
  - all ready -> phase advance after 500ms
- build test modal uses `PlaytestCanvas` against a preview segment.

### 3.4 Validation phase

`ValidationPhase`:

- duration: local 120s unless `phaseRemainingMs` exists.
- uses `currentSegment`.
- `PlaytestCanvas` calls `onClear`, then `recordValidation(true)`.
- timeout or manual proceed before clear records `false`.
- result is stored by `validateCurrentSegment(cleared, clearTimeMs)`.
- all player records ready -> phase advance after 500ms.

### 3.5 Merging phase

`MergingPhase`:

- calls `mergeCurrentRoomMap` once via `hasStartedRef`.
- if remote merge returns null, store builds fallback/merged map locally.
- waits at least 1400ms before advancing.
- displays validated segment count, merged segment count, global placements, Y delta, fallback note.

### 3.6 Race phase

`RacePhase`:

- default local timer 300s.
- if no finisher at 0, local overtime 30s.
- if server timer exists, uses `phaseRemainingMs` and `isRaceOvertime`.
- `RaceCanvas` props:
  - `players`
  - `currentUserId`
  - `mergedMap`
  - `racePositions`
  - `isExtended`
  - `elapsedSeconds`
  - `onProgress`
  - `onFinish`
- `onProgress` updates store and broadcasts local position when local player progress is present.
- progress >= 100 records finish time.
- all players finished -> phase advance after 900ms.
- manual result button also advances.

### 3.7 Results phase

`ResultsPhase`:

- sorts by `rankRacePlayers`.
- finished players sort by `raceFinishedAtMs`.
- unfinished players sort by `raceDistanceToGoal`.
- penalty label is based on `validationCleared === false`.

## 4. Modal and Overlay Inventory

| modal/overlay | owner symbol | state |
|---|---|---|
| Settings modal | `GameMakerApp` / `SettingsModal` | store `isSettingsOpen` |
| Asset load modal | `AssetStudio` / `AssetLoadModal` | local `isLoadModalOpen` |
| Asset review modal | `Warehouse` / `AssetReviewModal` | local `selectedAssetId` |
| Private room password modal | `Lobby` | local `privateJoinRoom` |
| Build test modal | `MapBuildPhase` / `BuildTestModal` | local `isBuildTestOpen` |
| Sketch move overlay | `SketchBoard` | local `tool === 'move'`, `isMoving` |
| Asset progress overlay | `AssetPreview` CSS/status | derived from asset status |

## 5. Drawing Behavior

근거: `client/src/App.tsx` `SketchBoard`, `client/src/components/AvatarCreator.tsx`

### 5.1 Current main drawing implementation

`SketchBoard`:

- uses `ReactSketchCanvas`
- tools: pen, eraser, eyedropper, move
- stroke width: range 2-16 step 2
- opacity: range 20-100 step 10
- palette: fixed `palette` list plus recent colors
- checker tone: light/dark
- undo/redo:
  - native canvas undo/redo
  - separate move undo/redo stacks for whole drawing translation
- move:
  - pointer drag translates paths
  - nudge buttons use `MOVE_NUDGE_PX = 8`
- resize:
  - canvas size change scales existing paths by width/height ratio
  - tool panel width, properties panel width, left section ratios are resizable and stored
- export:
  - workspace size = visible width/height * `SKETCH_WORKSPACE_SCALE = 3`
  - export frame = `{ x: width, y: height, width, height }`
  - exports full workspace PNG, crops visible frame with `cropImageRegion`
  - if `referenceImage` exists, composes reference + drawing via `composeSketchImage`
- eyedropper:
  - samples exported workspace drawing
  - if reference image exists and pointer is inside export frame, samples composed reference+drawing
- paste/drop:
  - image/file paste/drop is prevented by `clipboardContainsFile`, `dragEventContainsFile`

### 5.2 256x512 vs 400x400

| implementation | size | status |
|---|---:|---|
| `AvatarStudio` + `SketchBoard` | 256x512 visible frame, 3x workspace | current main path |
| `AvatarCreator` | 400x400 | not imported anywhere under `client/src`; deprecated/unused candidate |

`AvatarCreator` differences:

- inline styles, not `App.css`
- `CANVAS_SIZE = 400`
- guide silhouette background image `/guide-silhouette.png`
- only brush sizes 2/4/8 and 4 colors
- JSON `POST /api/assets/generate` with `{ image, prompt }`
- temporary white background during export

### 5.3 Drawing spike candidates

- Verify 3x workspace math for 256x512: code uses 768x1536 workspace; KJH doc says `768x1024`.
- Confirm whether `react-sketch-canvas` path scaling preserves stroke width correctly across n x m asset resize.
- Confirm eyedropper should exclude reference image when editing loaded asset or sample composed output.
- Confirm export/crop should normalize bbox before API submission or leave it to server.
- Confirm paste/drop prevention covers browser drag image edge cases.

## 6. Phaser Behavior

### 6.1 Map editor

`client/src/game/MapEditorCanvas.tsx`:

- board: 24 cols x 10 rows, `CELL_PX = 32`
- receives placements, selected asset, tool, locked state, zoom, endpoint label callback
- pointerdown -> `onToggleCell(x, y)`
- drag/drop -> `onDropAsset(assetId, x, y)`
- React handles validation/placement; Phaser renders board and pointer cell.
- `game.destroy(true)` cleanup exists.

### 6.2 Playtest

`client/src/game/PlaytestCanvas.tsx`:

- fixed render size 768x420
- player constants include `PLAYER = { width: 34, height: 74 }`
- keyboard controls via Phaser input:
  - A/D or arrows
  - Space
  - S/down
- scene owns collision, slopes, ground pound, crouch, sliding, items, monster/stomp, platform reactions.
- reaching goal calls `onClear()`.
- `game.destroy(true)` cleanup exists.

### 6.3 Race

`client/src/game/RaceCanvas.tsx`:

- fixed render size 768x420
- merged map cell mapping uses `MAP_CELL_X = 96`, `MAP_CELL_Y = 28`
- freeze constant `FREEZE_SECONDS = 15`
- player constants include `PLAYER = { width: 34, height: 70 }`
- scene emits progress/position via `onProgress`
- scene emits finish via `onFinish`
- includes remote racer rendering from `racePositions`.
- `game.destroy(true)` cleanup exists.

## 7. Legacy Behavior to Preserve Conceptually

V2 should preserve these behavioral contracts even if the UI is rebuilt:

- session gate: stored session restores into app; missing session shows login.
- remote API disabled/failing allows mock mode.
- generation states: queued -> generating -> ready/failed are visible and actionable.
- component warehouse excludes `item` from user-created filters.
- asset detail supports action-level regeneration with cooldown.
- loaded asset cannot be saved unchanged.
- map build locks after submit.
- start/end point cannot overlap placements and vertical delta is limited.
- build/validation/race timers advance phases.
- validation failure affects race penalty label/freeze.
- Phaser islands are controlled by typed props and callbacks.
