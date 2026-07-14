# Frontend V2 Route Model

작성일: 2026-07-13  
목적: 문자열 `navigate('...')` 대신 discriminated union 형태의 V2 route model과 hash URL 정책을 정의한다.

## 1. Current Model

현재 근거:

- `client/src/types/domain.ts` `AppView = 'main' | 'avatar' | 'studio' | 'warehouse' | 'lobby' | 'room'`
- `client/src/types/domain.ts` `RoomPhase = 'lobby' | 'building' | 'validating' | 'merging' | 'racing' | 'finished'`
- `client/src/App.tsx` `GameMakerApp`가 topbar와 조건부 렌더로 화면을 전환한다.

문제:

- `room` 하나가 C/S4/D/M/E/F를 모두 phase switch로 품고 있다.
- modal/overlay route가 local boolean/local state에 흩어져 있다.
- route가 화면 계약을 충분히 설명하지 못한다.

## 2. Target Route Union

```ts
type V2Route =
  | { kind: 'login'; screenId: 'S1_LOGIN' }
  | { kind: 'main'; screenId: 'S2_MAIN' }
  | { kind: 'warehouse'; screenId: 'S2B_WAREHOUSE'; tab: 'avatar' | 'component'; filter?: 'all' | 'platform' | 'obstacle' | 'monster' | 'background' }
  | { kind: 'avatarStudio'; screenId: 'A_AVATAR_STUDIO'; sourceAssetId?: string; mode: 'new' | 'edit' | 'remix' }
  | { kind: 'assetStudio'; screenId: 'B_ASSET_STUDIO'; sourceAssetId?: string; mode: 'new' | 'edit' | 'remix' }
  | { kind: 'lobby'; screenId: 'S3_LOBBY' }
  | { kind: 'room'; screenId: 'C_ROOM_LOBBY'; roomId: string }
  | { kind: 'mapBuild'; screenId: 'S4_MAP_BUILD'; roomId: string }
  | { kind: 'validation'; screenId: 'D_VALIDATION'; roomId: string; segmentId?: string }
  | { kind: 'merging'; screenId: 'M_MERGING'; roomId: string }
  | { kind: 'race'; screenId: 'E_RACE'; roomId: string; mergedMapId?: string }
  | { kind: 'results'; screenId: 'F_RESULTS'; roomId: string }
```

## 3. Overlay Route Union

```ts
type V2OverlayRoute =
  | { kind: 'settings'; screenId: 'S2C_SETTINGS_MODAL' }
  | { kind: 'assetReview'; assetId: string }
  | { kind: 'assetLoad'; studio: 'avatar' | 'asset'; tab: 'mine' | 'others' }
  | { kind: 'privateRoomPassword'; roomId: string }
  | { kind: 'buildTest'; roomId: string }
  | { kind: 'toast'; toastId: string }
```

Overlay route is optional and sits beside the base route:

```ts
interface V2NavigationState {
  route: V2Route
  overlays: V2OverlayRoute[]
}
```

## 4. Route Derivation Rules

| Current state | Target route |
|---|---|
| `session === null` | `{ kind:'login' }` |
| `view === 'main'` | `{ kind:'main' }` |
| `view === 'warehouse'` | `{ kind:'warehouse', tab: warehouseTab }` |
| `view === 'avatar'` | `{ kind:'avatarStudio', sourceAssetId: studioSourceAssetId ?? undefined }` |
| `view === 'studio'` | `{ kind:'assetStudio', sourceAssetId: studioSourceAssetId ?? undefined }` |
| `view === 'lobby'` | `{ kind:'lobby' }` |
| `view === 'room'` and `phase === 'lobby'` | `{ kind:'room', roomId }` |
| `view === 'room'` and `phase === 'building'` | `{ kind:'mapBuild', roomId }` |
| `view === 'room'` and `phase === 'validating'` | `{ kind:'validation', roomId }` |
| `view === 'room'` and `phase === 'merging'` | `{ kind:'merging', roomId }` |
| `view === 'room'` and `phase === 'racing'` | `{ kind:'race', roomId }` |
| `view === 'room'` and `phase === 'finished'` | `{ kind:'results', roomId }` |
| `isSettingsOpen === true` | overlay `{ kind:'settings' }` |

## 5. Guards

| Route | Guard | Failure route/error |
|---|---|---|
| `main`, `warehouse`, `avatarStudio`, `assetStudio`, `lobby` | session exists | `S1_LOGIN` |
| `room` | currentRoom id matches and phase lobby | `S3_LOBBY` with room not found/stale error |
| `mapBuild` | currentRoom phase building | derive current phase route |
| `validation` | currentRoom phase validating and currentSegment exists | empty/error state inside D |
| `merging` | currentRoom phase merging | derive current phase route |
| `race` | currentRoom phase racing | derive current phase route |
| `results` | currentRoom phase finished or results final | derive current phase route |
| `assetReview` | asset exists | close overlay with not found toast |
| `privateRoomPassword` | room exists, private, joinable | close overlay with stale room toast |

## 6. Navigation Actions

| Controller action | Target route behavior |
|---|---|
| `goMain()` | route `main`, clear studio source |
| `goLobby()` | route `lobby`, preserve session |
| `openWarehouse(tab)` | route `warehouse` with tab |
| `openAvatarStudio(sourceAssetId?)` | route `avatarStudio`; source id sets edit/remix mode |
| `openAssetStudio(sourceAssetId?)` | route `assetStudio`; source id sets edit/remix mode |
| `enterRoom(room)` | route derived from room phase |
| `syncRouteFromRoomPhase(room.phase)` | converts C/S4/D/M/E/F without string switches in UI |
| `leaveRoom()` | route `lobby` |
| `openSettings()` | push settings overlay |
| `closeOverlay(kind)` | remove matching overlay |

## 7. Browser URL Policy

V2 prototype routing uses the dedicated `client/ui-v2.html` entry and hash URLs:

- `/ui-v2.html#/ui-lab`
- `/ui-v2.html#/state-gallery?case=<fixture-id>`
- `/ui-v2.html#/shells`
- `/ui-v2.html#/login`
- `/ui-v2.html#/main`
- `/ui-v2.html#/lobby`
- `/ui-v2.html#/room?roomId=<room-id>`
- `/ui-v2.html#/map-build?roomId=<room-id>`
- `/ui-v2.html#/validation?roomId=<room-id>`
- `/ui-v2.html#/merging?roomId=<room-id>`
- `/ui-v2.html#/race?roomId=<room-id>`
- `/ui-v2.html#/results?roomId=<room-id>`
- `/ui-v2.html#/avatar-studio?sourceAssetId=<asset-id>`
- `/ui-v2.html#/asset-studio?sourceAssetId=<asset-id>`
- `/ui-v2.html#/warehouse?tab=avatar|component&filter=all|platform|obstacle|monster|background`

`client/src/app/navigation/prototypeRouter.ts` is the current code authority for parsing and generating these URLs. Browser back/forward is handled by `hashchange`/`popstate` in `AppV2`, and invalid paths render the V2 NotFound state instead of falling back to a legacy route.

## 8. Migration Gaps

| ID | Gap |
|---|---|
| ROUTE-GAP-001 | RESOLVED for V2 entry: room phases S4/D/M/E/F use separate route kinds. Legacy `AppView` remains only in legacy root until removal. |
| ROUTE-GAP-002 | RESOLVED for V2 entry: `prototypeRouter.ts` owns typed route parsing/generation and flow callbacks use route helpers. |
| ROUTE-GAP-003 | OPEN: modal/overlay state is still mostly controller-local rather than a fully URL-addressable overlay route model. |
| ROUTE-GAP-004 | RESOLVED: V2 uses `ui-v2.html` hash URLs and renders V2 NotFound for invalid paths. |
