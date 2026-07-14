# Frontend V2 API Contract

작성일: 2026-07-13  
목적: V2 화면이 사용할 API action과 REST migration gap을 고정한다.

## 1. Principles

- 화면은 endpoint path를 직접 알면 안 된다.
- 화면은 controller/store action만 호출한다.
- `VITE_DATA_MODE=mock|remote`가 data source를 결정한다.
- remote mode 실패는 mock 자동 fallback이 아니다.
- 확인 불가능한 request/response payload는 `TBD-CONTRACT`로 둔다.

## 2. Common Types

### 2.1 Success Envelope

현재 backend와 client unwrap 근거:

- `backend/src/http/routes/apiRoutes.ts` returns `{ ok: true, session|ticket|assets|asset|room|rooms|segment|mergedMap|job }`
- `client/src/net/api.ts` `unwrapApiResponse` reads `data`, `user`, `session`, `ticket`, `asset`, `assets`, `room`, `rooms`, `segment`, `mergedMap`, `merged_map`, `job`

V2 contract:

```ts
type ApiSuccess<T> = { ok: true; data: T } | Record<string, unknown>
```

Adapter may unwrap legacy keys, but feature/UI must receive typed domain data.

### 2.2 Error Envelope

```ts
interface ApiErrorBody {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
    retryable?: boolean
  }
}
```

Typed error mapping is defined in `docs/frontend-v2/contracts/error-taxonomy.md`.

## 3. API Action Matrix

| Screen action | Current endpoint | Target endpoint | Method | Request schema | Response schema | Typed error | Mock behavior | Remote behavior | Retry policy | Source evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| `session.login` | `/api/session` | `/api/session` | POST | `{ nickname: string(1..12) }` | `UserSession` | validation, authentication, server unavailable, malformed response | create local session and persist | create backend session; no mock fallback in remote mode | no automatic retry; user retry | `client/src/net/api.ts createSession`, `backend/src/http/routes/apiRoutes.ts /session` |
| `session.restore` | V2 remote port validates persisted session through `/api/session/validate`; legacy root still reads localStorage directly | `/api/session/validate` | POST | `{ token: string }` or bearer token | `UserSession` or invalid/null | authentication, server unavailable, malformed response | read stored mock session | validate backend session token; invalid token clears V2 session; no mock fallback in remote mode | no automatic retry | `createRemoteSessionPort.validateSession`, `apiRoutes.ts /session/validate`, `login-controller.test`, `remote-v2-flow.test`, backend contract test |
| `settings.issueDeviceLink` | `/api/device-link-codes` | `/api/device-link-codes` | POST | `{ user_id: string }` | `DeviceLinkTicket { code, expiresAt }` | authentication, not found, server unavailable | create 5min local code | backend issues code for session | no automatic retry | `createDeviceLinkCode`, `apiRoutes.ts /device-link-codes` |
| `settings.consumeDeviceLink` | `/api/device-link-codes/consume` | `/api/device-link-codes/consume` | POST | `{ code: string }` | `UserSession` | not found, authentication, server unavailable | consume local code if valid | backend returns session | no automatic retry | `consumeDeviceLinkCode`, `apiRoutes.ts /device-link-codes/consume` |
| `settings.updateNickname` | `/api/session/nickname` in V2 remote port; legacy store local-only | `/api/session/nickname` | POST | `{ token?: string, nickname: string(1..12) }` plus bearer token | `UserSession` | validation, authentication, server unavailable, malformed response | update mock session and persist | backend updates session nickname; no mock fallback in remote mode | no automatic retry | `createRemoteMainSessionPort`, `apiRoutes.ts /session/nickname`, backend contract test |
| `assets.list` | `/api/assets?user_id=<id>` | `/api/assets?user_id=<id>` | GET | query `user_id` | `Asset[]` | authentication, server unavailable, malformed response | merge starter assets + mock assets | return system/public/user assets | asset-job polling may call every >=5s only for working assets | `listAssets`, `apiRoutes.ts /assets` |
| `assets.createAvatar` | primary `/api/assets/avatar/generate`, fallback `/api/assets/generate` | `/api/assets/avatar/generate` for avatar FormData/JSON; `/api/assets/generate` remains generic compatibility | POST | `CreateAssetPayload` as FormData/JSON, `category='avatar'`, image data | `Asset` or pending asset with job id | validation, category mismatch, rate limit/cooldown, asset job failure, server unavailable | create mock generating/failed asset | create job/asset; no fallback to mock in remote mode; avatar route rejects non-avatar category with `ASSET_CATEGORY_MISMATCH` | no automatic request retry; job status follows push/polling | `postAssetGeneration`, `apiRoutes.ts /assets/avatar/generate`, `apiRoutes.ts /assets/generate`, backend contract test |
| `assets.createComponent` | `/api/assets/generate` | `/api/assets/generate` | POST | `category in platform|obstacle|monster|background`, name required, attrs, width/height 1..8, image | `Asset` or pending asset with job id | validation, `ASSET_CATEGORY_NOT_ALLOWED` for `item`, rate limit/cooldown, asset job failure, server unavailable | create mock generating/failed asset | create job/asset; no fallback to mock; user-generated `item` rejected while system item remains allowed in global asset domain | no automatic request retry | `AssetStudio`, `createAsset`, `apiRoutes.ts /assets/generate`, backend contract test |
| `assets.getJobStatus` | none; current remote polling may still use `assets.list` for session-wide refresh | `/api/assets/generation-jobs/:jobId` | GET | `jobId` path, bearer session or `user_id` query for visibility | `AssetJobSnapshot` | not found, server unavailable, asset job failure | derive from mock asset status | backend route returns one job snapshot by id; no mock fallback in remote mode | limited polling fallback only for asset jobs | `docs/LSJ/backend.md`, `apiRoutes.ts /assets/generation-jobs/:jobId`, backend contract test |
| `assets.requestSpriteRegeneration` | `/api/assets/:assetId/sprites/:action/regenerate` in V2 remote port; legacy store local mutation | `/api/assets/:assetId/sprites/:action/regenerate` | POST | path `assetId`, `action`; body `{ user_id }`; bearer token | updated `Asset` with target sprite generating | validation, `ASSET_ACTION_NOT_FOUND`, `ASSET_NOT_READY`, `ASSET_ACTION_COOLDOWN`, server unavailable | mark sprite queued/generating and apply cooldown | backend queues target sprite/action; no mock fallback in remote mode | no automatic retry; cooldown 5min | `createRemoteWarehouseAssetPort`, `apiRoutes.ts /sprites/:action/regenerate`, backend contract test |
| `rooms.list` | `/api/rooms` | `/api/rooms` | GET | none | `RoomSummary[]` | server unavailable, malformed response | read mock rooms | backend room summaries | user refresh/manual retry | `listRooms`, `apiRoutes.ts /rooms` |
| `rooms.create` | `/api/rooms` | `/api/rooms` | POST | `{ user_id, name, is_public, password?, max_players:2|3|4 }` | `RoomSummary` | validation, authentication, conflict, server unavailable | create mock room and password | create backend in-memory room | no automatic retry | `createRoom`, `apiRoutes.ts /rooms` |
| `rooms.joinPublic` | `/api/rooms/public/join` | `/api/rooms/public/join` | POST | `{ user_id }` | `RoomSummary` | not found, conflict, server unavailable | choose joinable mock public room | join backend public room | no automatic retry | `joinPublicRoom`, `apiRoutes.ts /rooms/public/join` |
| `rooms.joinById` | `/api/rooms/:roomId/join` | `/api/rooms/:roomId/join` | POST | `{ user_id, password? }` | `RoomSummary` | not found, authorization, conflict, server unavailable | validate mock password | join backend room | no automatic retry | `joinRoom`, `apiRoutes.ts /rooms/:roomId/join` |
| `map.submitSegment` | `/api/rooms/:roomId/segments` | `/api/rooms/:roomId/segments` | POST | `{ user_id, start_point, end_point, assets[] }` | `MapSegmentSnapshot` | validation, conflict, not found, server unavailable | save mock segment with hash | save backend segment with hash | no automatic retry unless user resubmits | `saveMapSegment`, `apiRoutes.ts /segments` |
| `map.validateSegment` | `/api/rooms/:roomId/segments/validate` | `/api/rooms/:roomId/segments/validate` | POST | `{ user_id, segment_hash, cleared, clear_time_ms }` | `MapSegmentSnapshot` | not found, conflict, server unavailable | update mock segment validation | update backend segment validation | user retry if not recorded | `validateMapSegment`, `apiRoutes.ts /segments/validate` |
| `map.mergeRoomMap` | `/api/rooms/:roomId/merge` | `/api/rooms/:roomId/merge` | POST | no body currently | `MergedMap` | not found, server unavailable, malformed response | build local fallback if API null in current code | backend merges validated segments | retry by controller; no silent success in remote mode | `mergeRoomMap`, `apiRoutes.ts /merge`, `appStore.mergeCurrentRoomMap` |

## 4. Migration Gaps

| ID | Gap | Required before implementation |
|---|---|---|
| API-GAP-001 | CLOSED for V2 entry: V2 controllers select ports through `VITE_DATA_MODE`; legacy `client/src/net/api.ts` still uses `VITE_REMOTE_API` only for the legacy root. | Keep legacy env path isolated until final removal. |
| API-GAP-002 | CLOSED for V2 entry: V2 remote ports surface typed errors and do not select mock ports on remote failure. Legacy root fallback remains outside the V2 entry until removal. | Keep `remote-v2-flow`, controller checks, and browser remote flow green. |
| API-GAP-003 | CLOSED: Avatar primary endpoint `/api/assets/avatar/generate` is implemented in current backend. | Keep `/api/assets/generate` as generic compatibility; route-specific avatar endpoint accepts FormData/JSON and rejects category mismatch. |
| API-GAP-004 | CLOSED: Asset job status route is documented in LSJ backend and now implemented in current backend. | Keep `/api/asset-jobs` for session-wide bounded polling; use `/api/assets/generation-jobs/:jobId` when a controller tracks a specific job id. |
| API-GAP-005 | CLOSED: Sprite regeneration remote endpoint is implemented and used by the V2 Warehouse remote port. | Keep cooldown/status behavior covered by backend and Warehouse controller tests. |
| API-GAP-006 | CLOSED: Nickname remote update is implemented through `/api/session/nickname` and used by the V2 Main/Settings remote port. | Keep validation/authentication behavior covered by backend and Main/Settings controller tests. |
