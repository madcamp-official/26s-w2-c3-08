# Frontend V2 Phase 0 Current Architecture

작성일: 2026-07-13  
근거: 현재 저장소 코드와 문서. 추측 없이 파일 경로와 symbol 이름을 기준으로 기록한다.

## 1. Runtime Entry

| 경로 | symbol | 현재 역할 |
|---|---|---|
| `client/src/main.tsx` | `createRoot(...).render(...)` | React entry. `AppErrorBoundary` 아래 `App` 렌더 |
| `client/src/App.tsx` | `App` | boot, session gate, 1초 tick setup |
| `client/src/App.tsx` | `GameMakerApp` | topbar navigation, view 조건부 렌더, settings modal |
| `client/src/App.css` | 전역 CSS | 2,724줄 단일 stylesheet. 전체 UI/Phaser host/modal/style token 포함 |

`App`의 session gate:

- `boot()` 실행: `client/src/store/appStore.ts`의 `boot`
- `session === null`이면 `LoginScreen`
- session이 있으면 `GameMakerApp`
- session이 있으면 1초마다 `tickMockGeneration`, `tickRoomElapsed` 실행

## 2. Domain Types

근거: `client/src/types/domain.ts`

| type/interface | 현재 값 또는 역할 |
|---|---|
| `AppView` | `main`, `avatar`, `studio`, `warehouse`, `lobby`, `room` |
| `WarehouseTab` | `avatar`, `component` |
| `AssetCategory` | `avatar`, `platform`, `obstacle`, `monster`, `background`, `item` |
| `AssetStatus` | `queued`, `generating`, `ready`, `failed` |
| `RoomPhase` | `lobby`, `building`, `validating`, `merging`, `racing`, `finished` |
| `UserSession` | `id`, `nickname`, `token`, `avatarAssetId` |
| `Asset` | creator/system/category/attrs/collider/size/source/remix/status/sprites |
| `RoomSummary` | host/public/player count/phase/elapsed |
| `MapSegmentSnapshot` | room/creator/start/end/placements/assetRefs/hash/validation |
| `MergedMap` | room/globalStart/globalEnd/placements/segments/fallback |

주의:

- docs/LSJ backend는 phase를 uppercase `LOBBY -> ... -> RESULTS`로 설명하지만 frontend domain은 lowercase이며 결과 phase는 `finished`다.
- `AssetCategory`에는 `item`이 포함된다. KJH 문서는 item을 시스템 제공만으로 제한한다.

## 3. UI Layer

근거: `client/src/App.tsx`

| symbol | 역할 | 결합된 책임 |
|---|---|---|
| `LoginScreen` | 닉네임 입력, `login` action 호출 | validation, submit 상태 |
| `MainDashboard` | CTA, avatar panel, asset metrics | asset status 계산 |
| `AvatarStudio` | 256x512 아바타 drawing submit | drawing board, remix, equip list |
| `AssetStudio` | component asset drawing submit | category/attrs/size/load modal |
| `AssetLoadModal` | mine/others asset load | modal state, asset filtering |
| `SketchBoard` | drawing editor | react-sketch-canvas, export/crop/eyedropper/move/history/panel resize/storage |
| `Warehouse` | avatar/component tabs, asset grid | filters, equip, retry, review modal |
| `AssetReviewModal` | asset detail/regenerate/edit/equip | cooldown timer, sprite action tabs |
| `Lobby` | room create/list/join/private password modal | room API action, local form state |
| `RoomFlow` | room phase switch | start/ready/leave controls |
| `RoomLobbyPhase` | ready/start lobby UI | minimum player checks, mock override |
| `MapBuildPhase` | map editor HUD + phase timer | placement validation, time vote, submit, test modal |
| `BuildTestModal` | playtest modal | `PlaytestCanvas` wrapper |
| `ValidationPhase` | validation playtest + result recording | 120s timer, `validateCurrentSegment` |
| `MergingPhase` | map merge progress | `mergeCurrentRoomMap`, auto advance |
| `RacePhase` | race HUD + `RaceCanvas` | local timer/overtime, progress/finish callbacks |
| `ResultsPhase` | ranking result | `rankRacePlayers`, leave room |
| `SettingsModal` | BGM/SFX, nickname, device link | localStorage settings, session transfer |

`App.tsx` 하단 utility도 화면과 같은 파일에 있다:

- asset attrs: `getAttrGroups`, `getDefaultAttrSelections`, `buildAssetAttrs`, `getAssetAttributeRows`
- drawing: `cropImageRegion`, `composeSketchImage`, `sampleImageColor`, `sampleSketchExportColor`, `translateCanvasPaths`, `scaleCanvasPaths`
- map validation: `buildDefaultMapTemplate`, `isEndpointHeightDeltaAllowed`, `buildPreviewMapSegment`, `doGridRectsOverlap`
- race/result: `rankRacePlayers`, `raceResultLabel`, `formatRaceTime`
- storage: `readStudioLayoutPreference`, `saveStudioLayoutPreference`

## 4. Store Layer

근거: `client/src/store/appStore.ts`

### 4.1 State

`AppState`가 보유한 상태:

- navigation/UI: `view`, `warehouseTab`, `studioSourceAssetId`, `isLoading`, `isSettingsOpen`
- session/settings: `session`, `settings`
- assets: `assets`
- rooms/game: `rooms`, `currentRoom`, `roomPlayers`, `mapSegments`, `currentSegment`, `mergedMap`
- realtime/race: `racePositions`, `realtimeStatus`, `phaseRemainingMs`, `currentTimeVote`, `isRaceOvertime`
- source: `apiSource`

### 4.2 Public Actions

`AppState` public action:

- session: `boot`, `login`, `logout`
- navigation/UI: `navigate`, `openWarehouse`, `openStudioWithAsset`, `clearStudioSourceAsset`, `setSettingsOpen`
- assets: `refreshAssets`, `submitAsset`, `equipAvatar`, `requestSpriteRegeneration`
- rooms: `refreshRooms`, `createRoom`, `enterRoom`, `enterPublicRoom`, `leaveRoom`
- room phase: `toggleLobbyReady`, `advanceRoomPhase`, `requestTimeVote`
- map/validation/merge: `submitMapSegment`, `validateCurrentSegment`, `mergeCurrentRoomMap`, `markValidationCleared`
- race: `updateRaceProgress`, `recordRaceFinish`, `broadcastRacePosition`
- ticks: `tickMockGeneration`, `tickRoomElapsed`
- settings/device: `updateSettings`, `updateNickname`, `issueDeviceLinkCode`, `loadSessionByDeviceCode`

### 4.3 API Calling Actions

| action | imported API symbol |
|---|---|
| `boot` | `getStoredSession`, then `refreshAssets`, `refreshRooms` |
| `login` | `createSession` |
| `logout` | `saveStoredSession(null)` |
| `refreshAssets` | `listAssets` |
| `refreshRooms` | `listRooms` |
| `submitAsset` | `createAsset` |
| `createRoom` | `createRoom` from API |
| `enterRoom` | `joinRoom as joinRoomRequest` |
| `enterPublicRoom` | `joinPublicRoom` |
| `submitMapSegment` | `saveMapSegment` |
| `validateCurrentSegment` | `validateMapSegment` |
| `mergeCurrentRoomMap` | `mergeRoomMap` |
| `issueDeviceLinkCode` | `createDeviceLinkCode` |
| `loadSessionByDeviceCode` | `consumeDeviceLinkCode` |

### 4.4 Realtime Calling Actions

| action/helper | imported realtime symbol |
|---|---|
| `boot`, `login`, `loadSessionByDeviceCode` | `connectStoreRealtime` -> `connectRealtime` |
| `logout` | `disconnectRealtime` |
| `createRoom`, `enterRoom`, `enterPublicRoom` | `joinRealtimeRoom` |
| `leaveRoom` | `leaveRealtimeRoom` |
| `toggleLobbyReady` | `notifyRealtimeLobbyReady` |
| `advanceRoomPhase` | `startRealtimeRoom`, `readyRealtimePhase`, `notifyRealtimeResultsFinal` |
| `requestTimeVote` | `requestRealtimeTimeVote` |
| `submitMapSegment` | `notifyRealtimeMapSegmentSnapshot`, `notifyRealtimeSegmentSubmitted` |
| `validateCurrentSegment` | `notifyRealtimeValidationCompleted` |
| `mergeCurrentRoomMap` | `notifyRealtimeMapMerged` |
| `recordRaceFinish` | `notifyRealtimeRaceFinish` |
| `broadcastRacePosition` | `sendRealtimeRacePosition` |
| `updateNickname` | `notifyRealtimeLobbyPresence` |

### 4.5 Slice 후보

| 후보 slice | 근거 상태/action |
|---|---|
| `sessionSlice` | `session`, `boot`, `login`, `logout`, device link |
| `settingsSlice` | `settings`, `isSettingsOpen`, `updateSettings`, `updateNickname` |
| `assetSlice` | `assets`, `refreshAssets`, `submitAsset`, `requestSpriteRegeneration`, `tickMockGeneration` |
| `navigationSlice` | `view`, `warehouseTab`, `studioSourceAssetId`, navigation actions |
| `roomSlice` | `rooms`, `currentRoom`, room join/create/leave |
| `phaseSlice` | `roomPlayers`, `phaseRemainingMs`, `currentTimeVote`, phase actions |
| `mapSlice` | `mapSegments`, `currentSegment`, `mergedMap`, segment/merge actions |
| `raceSlice` | `racePositions`, `isRaceOvertime`, progress/finish/broadcast actions |

## 5. API Layer

근거: `client/src/net/api.ts`, `backend/src/http/app.ts`, `backend/src/http/routes/apiRoutes.ts`

### 5.1 Remote/Mock 분기

- `REMOTE_API_ENABLED = import.meta.env.VITE_REMOTE_API === 'true'`
- `getJson`, `postJson`, `postFormData`는 remote disabled, non-OK response, fetch error 모두 `null` 반환
- public API action은 `null` remote 결과일 때 mock data를 사용하거나 `null`을 caller에 반환한다.
- `apiSource`는 `'api' | 'mock'`로 store에 저장된다.

### 5.2 Client endpoint 후보

| client symbol | remote path |
|---|---|
| `createSession` | `POST /api/session` |
| `createDeviceLinkCode` | `POST /api/device-link-codes` |
| `consumeDeviceLinkCode` | `POST /api/device-link-codes/consume` |
| `listAssets` | `GET /api/assets?user_id=<id>` |
| `createAsset` | `POST /api/assets/avatar/generate` for avatar FormData, `POST /api/assets/generate` otherwise; fallback JSON `POST /api/assets/generate` |
| `listRooms` | `GET /api/rooms` |
| `createRoom` | `POST /api/rooms` |
| `joinPublicRoom` | `POST /api/rooms/public/join` |
| `joinRoom` | `POST /api/rooms/:roomId/join` |
| `saveMapSegment` | `POST /api/rooms/:roomId/segments` |
| `validateMapSegment` | `POST /api/rooms/:roomId/segments/validate` |
| `mergeRoomMap` | `POST /api/rooms/:roomId/merge` |

### 5.3 Backend route 후보

`backend/src/http/app.ts` mounts `apiRoutes` at `/api`.

| backend route | 상태 |
|---|---|
| `POST /api/session` | 있음 |
| `POST /api/device-link-codes` | 있음 |
| `POST /api/device-link-codes/consume` | 있음 |
| `GET /api/assets` | 있음 |
| `POST /api/assets/generate` | 있음 |
| `GET /api/rooms` | 있음 |
| `POST /api/rooms` | 있음 |
| `POST /api/rooms/public/join` | 있음 |
| `POST /api/rooms/:roomId/join` | 있음 |
| `POST /api/rooms/:roomId/segments` | 있음 |
| `POST /api/rooms/:roomId/segments/validate` | 있음 |
| `POST /api/rooms/:roomId/merge` | 있음 |
| `POST /api/assets/avatar/generate` | 없음 |

### 5.4 Response unwrap

`unwrapApiResponse<T>`는 `payload.ok === true`일 때 다음 key를 순서대로 반환한다:

`data`, `user`, `session`, `ticket`, `asset`, `assets`, `room`, `rooms`, `segment`, `mergedMap`, `merged_map`, `job`

`ok !== true` 또는 record가 아니면 payload 자체를 `T`로 반환한다.

## 6. Realtime Layer

근거: `client/src/net/realtime.ts`, `backend/src/socket/index.ts`, `server/src/rooms/MyRoom.ts`

### 6.1 Frontend implementation

- Colyseus SDK: `Client`, `Room`
- default URL: dev/browser localhost는 `ws://localhost:2567`, 그 외 현재 host 기반 `ws/wss`
- room name: `VITE_COLYSEUS_ROOM_NAME ?? 'my_room'`
- latency timeout: `1_500ms`
- local fallback: `BroadcastChannel('relay.localRealtime.v1')`
- local fallback enabled: `VITE_LOCAL_REALTIME !== 'false'`
- status: `idle`, `connecting`, `connected`, `local`, `offline`

### 6.2 Frontend emit event names

`notify*/send*` public functions emit:

- `lobby:presence`
- `lobby:leave`
- `lobby:ready`
- `room:start`
- `phase:ready`
- `time_vote:request`
- `segment:submitted`
- `segment:snapshot`
- `validation:completed`
- `race:position`
- `race:finish`
- `results:final`
- `map:merged`
- global local only: `rooms:changed`

### 6.3 Frontend receive event names

`handleRealtimeMessage` handles:

- `room:joined`
- `room:state`
- `phase:changed`
- `timer:tick`
- `time_vote:updated`
- `segment:submitted`
- `segment:snapshot`
- `validation:result`
- `map:merged`
- `race:position`
- `race:finished`
- `results:final`
- `asset_job:updated`
- `rooms:changed`
- `lobby:player_joined`
- `lobby:ready`
- `lobby:leave`

### 6.4 Server mismatch

- `backend/src/socket/index.ts` implements Socket.IO events with mostly matching names.
- `server/src/rooms/MyRoom.ts` is Colyseus scaffold and does not implement the frontend event protocol.
- frontend currently connects with Colyseus SDK, not Socket.IO client. Therefore a fully remote realtime path is not contract-complete without choosing one transport or writing an adapter bridge.

## 7. Storage Layer

| key | file/symbol | storage | data |
|---|---|---|---|
| `relay.session` | `client/src/net/api.ts` `SESSION_KEY` | localStorage | `UserSession` |
| `relay.session.<profileId>` | `getSessionStorageKey` | localStorage | profile-scoped `UserSession` |
| `relay.session.profileId` | `SESSION_PROFILE_KEY` | sessionStorage | profile id from `?profile=` |
| `relay.mock.assets` | `MOCK_ASSETS_KEY` | localStorage | `Asset[]` |
| `relay.mock.deviceLinks` | `MOCK_DEVICE_LINKS_KEY` | localStorage | `StoredDeviceLink[]` |
| `relay.mock.mapSegments` | `MOCK_MAP_SEGMENTS_KEY` | localStorage | `MapSegmentSnapshot[]` |
| `relay.mock.roomPasswords` | `MOCK_ROOM_PASSWORDS_KEY` | localStorage | roomId -> password |
| `relay.mock.rooms` | `MOCK_ROOMS_KEY` | localStorage | `RoomSummary[]` |
| `relay.mock.rooms.capacityMigration.v1` | `MOCK_ROOM_CAPACITY_MIGRATION_KEY` | localStorage | migration marker |
| `relay.settings` | `client/src/store/appStore.ts` `SETTINGS_KEY` | localStorage | `UserSettings` |
| `relay.studioLayout` | `client/src/App.tsx` `STUDIO_LAYOUT_KEY` | localStorage | panel widths/collapsed/section ratios |

## 8. Phaser Layer

| file | React props down | callbacks/events up | lifecycle |
|---|---|---|---|
| `MapEditorCanvas.tsx` | placements, selectedAsset, selectedPlacementId, tool, toolLabel, canAffordSelectedAsset, isLocked, zoom, getEndpointLabel | `onToggleCell(x,y)`, `onDropAsset(assetId,x,y)` | mount `new Phaser.Game`, effect `syncState`, cleanup `game.destroy(true)` |
| `PlaytestCanvas.tsx` | isCleared, segment, resetSignal | `onClear()` | mount `new Phaser.Game`, effect `syncState`, cleanup `game.destroy(true)` |
| `RaceCanvas.tsx` | players, currentUserId, mergedMap, racePositions, isExtended, elapsedSeconds | `onProgress(progressById, localPosition?)`, `onFinish()` | mount `new Phaser.Game`, effect `syncState`, cleanup `game.destroy(true)` |

Common:

- `scale.mode` is `Phaser.Scale.NONE`.
- no `ResizeObserver` or window resize handler is present in wrappers.
- keyboard listeners are registered inside Phaser scenes through `this.input.keyboard?.on(...)`.
- Game rules are inside Phaser files and `assetRules.ts`, not shared `shared/physics`.

## 9. Shared/Backend/Server

### 9.1 `shared/`

| file | current state |
|---|---|
| `shared/constants.ts` | `TILE_PX = 64`, `AVATAR_CANVAS = { w: 64, h: 128 }`, `AVATAR_HITBOX_H = { minPx: 83, maxPx: 125 }`, `REGEN_COOLDOWN_MS` |
| `shared/physics/index.ts` | empty export with TODO comments |
| `shared/schemas/index.ts` | empty export with TODO comments |

### 9.2 `backend/`

- Express app with `/health`, `/api`, `/internal/qwen`.
- Socket.IO server in `backend/src/socket/index.ts`.
- In-memory maps for sessions/assets/rooms/segments/merged maps/device links.
- Qwen route/client exists, but frontend asset generation currently calls `/api/assets/generate`, not `/internal/qwen/refine`.

### 9.3 `server/`

- Colyseus scaffold with room name `my_room`.
- `MyRoomState` only has `mySynchronizedProperty = "Hello world"`.
- `MyRoom` logs join/leave and has placeholder `yourMessageType`.
- This does not implement the frontend realtime room protocol.

## 10. V2 Connection Boundary

Recommended Phase 1 boundary:

- New UI should call store actions, not direct API/realtime paths.
- Store should be sliced after the API/realtime contract is frozen.
- Phaser wrappers can remain, but V2 UI should treat them as controlled islands with typed props/callbacks.
- `shared/physics` and `shared/schemas` are not ready as source of truth yet; current source of truth is client code plus conflict register.
