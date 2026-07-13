# Frontend V2 Route Model

작성일: 2026-07-13  
목적: 문자열 `navigate('...')` 대신 discriminated union 형태의 목표 route model을 정의한다. 실제 코드는 만들지 않는다.

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
  | { kind: 'roomLobby'; screenId: 'C_ROOM_LOBBY'; roomId: string }
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
| `view === 'room'` and `phase === 'lobby'` | `{ kind:'roomLobby', roomId }` |
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
| `roomLobby` | currentRoom id matches and phase lobby | `S3_LOBBY` with room not found/stale error |
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

## 7. Migration Gaps

| ID | Gap |
|---|---|
| ROUTE-GAP-001 | Current `AppView` is too coarse for room phases. |
| ROUTE-GAP-002 | Current navigation is string-based store action. |
| ROUTE-GAP-003 | Current modals are local booleans/local selected ids, not overlay route state. |
| ROUTE-GAP-004 | Browser URL route policy is not defined. `TBD-CONTRACT` whether V2 uses URL paths or in-memory route only. |
