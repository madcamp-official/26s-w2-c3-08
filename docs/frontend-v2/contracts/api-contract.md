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
| `session.restore` | localStorage only | `TBD-CONTRACT` optional `/api/session/validate` | GET/POST TBD | `TBD-CONTRACT` | `UserSession` or invalid | authentication, server unavailable | read stored session | remote validation not implemented | no automatic retry | `client/src/net/api.ts getStoredSession`, `screen-design.md S1` |
| `settings.issueDeviceLink` | `/api/device-link-codes` | `/api/device-link-codes` | POST | `{ user_id: string }` | `DeviceLinkTicket { code, expiresAt }` | authentication, not found, server unavailable | create 5min local code | backend issues code for session | no automatic retry | `createDeviceLinkCode`, `apiRoutes.ts /device-link-codes` |
| `settings.consumeDeviceLink` | `/api/device-link-codes/consume` | `/api/device-link-codes/consume` | POST | `{ code: string }` | `UserSession` | not found, authentication, server unavailable | consume local code if valid | backend returns session | no automatic retry | `consumeDeviceLinkCode`, `apiRoutes.ts /device-link-codes/consume` |
| `settings.updateNickname` | local session only | `TBD-CONTRACT` `/api/session/nickname` or `/api/users/:id` | TBD | `{ user_id, nickname }` | `UserSession` | validation, authentication, conflict | update stored session only | not implemented | no automatic retry | `appStore.updateNickname`, `screen-design.md S2c` |
| `assets.list` | `/api/assets?user_id=<id>` | `/api/assets?user_id=<id>` | GET | query `user_id` | `Asset[]` | authentication, server unavailable, malformed response | merge starter assets + mock assets | return system/public/user assets | asset-job polling may call every >=5s only for working assets | `listAssets`, `apiRoutes.ts /assets` |
| `assets.createAvatar` | primary `/api/assets/avatar/generate`, fallback `/api/assets/generate` | preferred adapter target `/api/assets/generate`; avatar-specific route is `TBD-CONTRACT` | POST | `CreateAssetPayload` as FormData/JSON, `category='avatar'`, image data | `Asset` or pending asset with job id | validation, rate limit/cooldown, asset job failure, server unavailable | create mock generating/failed asset | create job/asset; no fallback to mock in remote mode | no automatic request retry; job status follows push/polling | `postAssetGeneration`, `apiRoutes.ts /assets/generate`, conflict C-003 |
| `assets.createComponent` | `/api/assets/generate` | `/api/assets/generate` | POST | `category in platform|obstacle|monster|background`, name required, attrs, width/height 1..8, image | `Asset` or pending asset with job id | validation, rate limit/cooldown, asset job failure, server unavailable | create mock generating/failed asset | create job/asset; no fallback to mock | no automatic request retry | `AssetStudio`, `createAsset`, `apiRoutes.ts /assets/generate` |
| `assets.getJobStatus` | none; current remote polling uses `assets.list` | `/api/assets/generation-jobs/:jobId` | GET | `jobId` path | `AssetJobSnapshot` | not found, server unavailable, asset job failure | derive from mock asset status | `TBD-CONTRACT`; LSJ backend doc specifies route but current backend lacks it | limited polling fallback only for asset jobs | `docs/LSJ/backend.md`, `appStore.tickMockGeneration`, current route absence |
| `assets.requestSpriteRegeneration` | local store mutation only | `TBD-CONTRACT` | POST TBD | `{ assetId, action }` | updated `AssetJobSnapshot` or `Asset` | rate limit/cooldown, not found, asset job failure | mark sprite queued/generating and apply cooldown | not implemented | no automatic retry; cooldown 5min | `appStore.requestSpriteRegeneration`, `AssetReviewModal`, `REGEN_COOLDOWN_MS` |
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
| API-GAP-001 | Current `api.ts` uses `VITE_REMOTE_API`; V2 requires `VITE_DATA_MODE`. | Replace env policy in adapter during implementation. |
| API-GAP-002 | Current remote failure returns `null` and falls back to mock. | Adapter must surface typed errors in remote mode. |
| API-GAP-003 | Avatar primary endpoint `/api/assets/avatar/generate` is not implemented in current backend. | Use `/api/assets/generate` or implement route; UI remains unchanged either way. |
| API-GAP-004 | Asset job status route is documented in LSJ backend but not implemented in current backend. | Add route or keep polling via `assets.list` with explicit limitation. |
| API-GAP-005 | Sprite regeneration remote endpoint is missing. | Define endpoint/payload before enabling remote regeneration. |
| API-GAP-006 | Nickname remote update is missing. | Define whether nickname is local-only MVP or backend update. |
