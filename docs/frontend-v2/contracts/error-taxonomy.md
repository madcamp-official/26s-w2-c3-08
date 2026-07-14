# Frontend V2 Error Taxonomy

작성일: 2026-07-13  
목적: 화면, API adapter, realtime adapter가 공통으로 사용할 typed error taxonomy를 정의한다.

## 1. Error Shape

```ts
type V2ErrorKind =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'asset_job_failure'
  | 'offline'
  | 'reconnecting'
  | 'server_unavailable'
  | 'malformed_response'

interface V2Error {
  kind: V2ErrorKind
  code: string
  message: string
  retryable: boolean
  fieldErrors?: Record<string, string[]>
  source?: 'api' | 'realtime' | 'storage' | 'drawing' | 'phaser'
}
```

## 2. Taxonomy

| Kind | When | Current code evidence | User-facing behavior | Retry policy |
|---|---|---|---|---|
| `validation` | form/body/schema invalid | backend `INVALID_REQUEST`; login nickname 1-12; asset name required | inline field error; keep user input | user edits and retries |
| `authentication` | session/token invalid or missing | `SESSION_EXPIRED`, device code session not found, `/api/session/validate` invalid token | route to login or show session expired | no automatic retry |
| `authorization` | user cannot access resource/action | private room invalid password maps here | modal/form error | user changes credential |
| `not_found` | room/segment/session/device code missing | `ROOM_NOT_FOUND`, `SEGMENT_NOT_FOUND`, `DEVICE_CODE_NOT_FOUND`, `NO_PUBLIC_ROOM` | stale state message; close invalid overlay if needed | manual refresh/retry |
| `conflict` | room full, phase mismatch, duplicate/unchanged submit | `ROOM_FULL`; loaded unchanged asset disabled in UI | disable or show state conflict | refresh then retry |
| `rate_limit` | cooldown or queue pressure | regen cooldown 5min in UI; backend 429 in LSJ Qwen policy | cooldown timer; no spam retry | wait until allowed |
| `asset_job_failure` | AI/Qwen/WAN/job fails | asset status `failed`; Qwen/WAN failure documented | failed badge and retry if allowed | retry through regen or new submit |
| `offline` | network unavailable or remote mode no connection | V2 remote ports return typed failure; Socket.IO manual disconnect maps to `offline` | persistent offline banner; remote actions disabled | retry when online/user refresh |
| `reconnecting` | realtime lost and reconnecting | Socket.IO `disconnect`, `reconnect_attempt`, and `reconnect_error` map to `reconnecting` unless manually disconnected | badge and disable remote phase actions | adapter reconnect only, no local fallback |
| `server_unavailable` | non-OK fetch, timeout, Socket.IO server down | V2 remote ports map fetch/non-OK failures to typed errors; Qwen/WAN timeout policy is explicit | toast/banner; keep local state | manual retry unless adapter has explicit limited polling |
| `malformed_response` | ok response shape cannot normalize | V2 remote API ports return `malformed_response` and call the malformed response diagnostics logger; State Gallery and accessibility suites include malformed/offline states | show contract error; log sanitized source details | no automatic retry |

## 3. Current Backend Code Mapping

| Backend code/event | V2 kind |
|---|---|
| `INVALID_REQUEST` | `validation` |
| `SESSION_NOT_FOUND` | `authentication` or `not_found` by context |
| `DEVICE_CODE_NOT_FOUND` | `not_found` |
| `NO_PUBLIC_ROOM` | `not_found` |
| `ROOM_NOT_JOINABLE` | `not_found` or `conflict` by phase |
| `ROOM_FULL` | `conflict` |
| `INVALID_PASSWORD` | `authorization` |
| `ROOM_NOT_FOUND` | `not_found` |
| `SEGMENT_NOT_FOUND` | `not_found` |
| Socket `INVALID_ROOM_JOIN` | `validation` |
| Socket `ROOM_NOT_JOINED` | `conflict` |
| Socket `ROOM_NOT_FOUND` | `not_found` |
| Qwen `IMAGE_REQUIRED` | `validation` |
| Qwen `INVALID_IMAGE_TYPE` | `validation` |

## 4. Screen Handling Rules

| Screen area | Handling |
|---|---|
| Login | validation inline; authentication routes to login; server unavailable as form-level error |
| Warehouse | asset job failure on card; malformed asset disables action and opens detail error |
| Settings | device code errors inline; storage errors non-blocking |
| Studio | drawing/export errors near submit; remote errors keep canvas/form intact |
| Lobby | join/create errors inline or modal-level; stale room closes password modal |
| Room/Game | offline/reconnecting badges; phase-changing controls disabled if remote authority unavailable |
| Phaser | Phaser runtime errors should be caught by React error boundary at wrapper level; gameplay state should not be silently reset unless wrapper remounts |

## 5. Malformed Response Logging Policy

`malformed_response` is a contract error, not a user-retryable transient error.
Adapters must keep returning typed `malformed_response` failures and must not switch to
Mock or local fallback.

Diagnostics destination:

- V2 adapters call `logMalformedResponse` from
  `client/src/infrastructure/diagnostics/malformedResponseLogger.ts`.
- The default destination is `console.warn('[frontend-v2] malformed response', details)`.
- A future production collector may wrap this logger, but the default implementation
  does not send body data to a remote logging endpoint.

Diagnostics fields:

- `source`: `api`, `realtime`, `storage`, `drawing`, or `phaser`.
- `adapter`: infrastructure adapter name, for example `remoteSessionPort`.
- `operation`: stable adapter action name, for example `session.create`.
- `reason`: `invalid_json` or `unexpected_shape`.
- `endpoint`: URL origin/path or relative path only. Query string and hash are removed.
- `status`: HTTP status when available.
- `body`: bounded sanitized summary for unexpected shape failures.

Redaction rules:

- Query strings and hash fragments are always stripped from logged endpoints.
- Object keys matching `authorization`, `bearer`, `token`, `password`, `secret`,
  `api_key`, `api-key`, `credential`, `cookie`, or `session` are replaced with
  `[redacted]`.
- Strings, arrays, object key counts, and nesting depth are bounded to avoid
  accidentally logging large payloads.

## 6. TBD-CONTRACT

| ID | Item |
|---|---|
| TBD-CONTRACT-ERR-001 | RESOLVED: `/api/session/validate` invalid token returns `SESSION_EXPIRED`; V2 remote session port maps authentication failure to an invalid/null session. |
| TBD-CONTRACT-ERR-002 | PARTIAL: GPU worker reports concrete Qwen/WAN/storage error codes; final production error-code catalog should be reviewed once deployed generator credentials are available. |
| TBD-CONTRACT-ERR-003 | RESOLVED: Socket.IO transport maps `connect_error` to `error`, reconnect attempts/errors to `reconnecting`, manual disconnect to `offline`, and successful connect to `connected`. |
| TBD-CONTRACT-ERR-004 | RESOLVED: malformed response diagnostics use the V2 diagnostics logger, `console.warn` by default, with query/hash stripping and sensitive field redaction. |
