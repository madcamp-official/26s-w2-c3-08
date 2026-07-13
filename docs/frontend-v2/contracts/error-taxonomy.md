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
| `authentication` | session/token invalid or missing | device code session not found; session restore validation is TBD | route to login or show session expired | no automatic retry |
| `authorization` | user cannot access resource/action | private room invalid password maps here | modal/form error | user changes credential |
| `not_found` | room/segment/session/device code missing | `ROOM_NOT_FOUND`, `SEGMENT_NOT_FOUND`, `DEVICE_CODE_NOT_FOUND`, `NO_PUBLIC_ROOM` | stale state message; close invalid overlay if needed | manual refresh/retry |
| `conflict` | room full, phase mismatch, duplicate/unchanged submit | `ROOM_FULL`; loaded unchanged asset disabled in UI | disable or show state conflict | refresh then retry |
| `rate_limit` | cooldown or queue pressure | regen cooldown 5min in UI; backend 429 in LSJ Qwen policy | cooldown timer; no spam retry | wait until allowed |
| `asset_job_failure` | AI/Qwen/WAN/job fails | asset status `failed`; Qwen/WAN failure documented | failed badge and retry if allowed | retry through regen or new submit |
| `offline` | network unavailable or remote mode no connection | V2 policy; current code catches fetch and returns null | persistent offline banner; remote actions disabled | retry when online/user refresh |
| `reconnecting` | realtime lost and reconnecting | current `RealtimeStatus` has `connecting`; V2 remote mode should expose reconnecting | badge and disable remote phase actions | adapter reconnect only, no local fallback |
| `server_unavailable` | non-OK fetch, timeout, Socket.IO server down | current fetch catch/null; Qwen timeout policy | toast/banner; keep local state | manual retry unless adapter has explicit limited polling |
| `malformed_response` | ok response shape cannot normalize | `unwrapApiResponse` currently permissive | show contract error; log source | no automatic retry |

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

## 5. TBD-CONTRACT

| ID | Item |
|---|---|
| TBD-CONTRACT-ERR-001 | Final remote authentication/session validation error codes. |
| TBD-CONTRACT-ERR-002 | Asset job failure code set from Qwen/WAN worker. |
| TBD-CONTRACT-ERR-003 | Socket.IO reconnect state names and close reason mapping. |
| TBD-CONTRACT-ERR-004 | Malformed response logging destination and redaction rules. |
