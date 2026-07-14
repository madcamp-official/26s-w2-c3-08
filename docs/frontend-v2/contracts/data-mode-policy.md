# Frontend V2 Data Mode Policy

작성일: 2026-07-13  
목적: mock/remote data와 local/remote realtime 모드를 명시적으로 분리한다.

## 1. Environment Variables

| Variable | Values | Contract |
|---|---|---|
| `VITE_DATA_MODE` | `mock` \| `remote` | API/data source 선택. development/test에서 값이 없으면 `mock`. production에서 값이 없으면 startup `ConfigurationError`. |
| `VITE_REALTIME_MODE` | `local` \| `remote` | realtime transport 선택. development/test에서 값이 없으면 `local`. production에서 값이 없으면 startup `ConfigurationError`. `local`에서만 BroadcastChannel/local transport 허용. |

Runtime default policy:

- development/test: missing `VITE_DATA_MODE` defaults to `mock`.
- development/test: missing `VITE_REALTIME_MODE` defaults to `local`.
- production: missing `VITE_DATA_MODE` is a startup configuration error.
- production: missing `VITE_REALTIME_MODE` is a startup configuration error.
- any invalid mode value is a startup configuration error.
- `VITE_DATA_MODE=remote` can select only the remote API adapter and must not call the Mock adapter as fallback.
- `VITE_REALTIME_MODE=remote` can select only the remote realtime adapter and must not switch to BroadcastChannel/local realtime as fallback.

Current migration gaps:

- Current API uses `VITE_REMOTE_API === 'true'`.
- Current realtime uses `VITE_LOCAL_REALTIME !== 'false'` and Colyseus/BroadcastChannel fallback.

## 2. Data Mode Rules

| Mode | API behavior | Storage behavior | Error behavior |
|---|---|---|---|
| `mock` | API adapter uses local mock implementations and mock storage. | `relay.mock.*` keys are authoritative. | mock validation errors are allowed; no remote calls required. |
| `remote` | API adapter calls backend REST. | `relay.mock.*` keys are ignored as fallback source. | fetch/non-OK/malformed response becomes typed error; no automatic mock fallback. Mock adapter cannot be selected in this mode. |

## 3. Realtime Mode Rules

| Mode | Realtime behavior | Failure behavior |
|---|---|---|
| `local` | Local transport may use BroadcastChannel for multi-tab mock/dev. | local unavailable becomes `offline`; no remote attempt required. |
| `remote` | Use `backend/` Socket.IO contract for MVP. | connection failure becomes `offline`/`reconnecting`; no automatic BroadcastChannel/local realtime fallback. Local realtime adapter cannot be selected in this mode. |

## 4. Allowed Fallbacks

| Fallback | Allowed? | Notes |
|---|---:|---|
| remote API -> mock API after fetch failure | No | Violates DECISION-V2-011 |
| remote realtime -> BroadcastChannel after socket failure | No | Violates DECISION-V2-012 |
| asset job push -> limited polling | Yes | DECISION-V2-009; asset job only |
| backend merge failure -> local merge in remote mode | No by default | Current code does this when API returns null; V2 remote mode must show typed error unless product explicitly allows fallback |
| mock mode local generation tick | Yes | mock mode only |

## 5. Asset Job Polling Policy

| Rule | Contract |
|---|---|
| trigger | only when there is a queued/generating asset/job and no recent push |
| interval | minimum 5 seconds, matching current `API_ASSET_POLL_INTERVAL_MS` unless changed |
| endpoint | prefer `/api/assets/generation-jobs/:jobId` for a known job id; `/api/asset-jobs?user_id=<id>` remains allowed for session-wide bounded polling |
| stop condition | all related assets/jobs ready/failed or user leaves relevant session |
| error | polling failure is non-terminal unless user action needs job status immediately |

## 6. UI State Mapping

| Adapter state | UI state |
|---|---|
| `mock` data mode | show optional mock/dev badge only in non-production |
| remote loading | loading |
| remote offline | offline |
| remote reconnecting realtime | reconnecting |
| remote server unavailable | error with retry |
| malformed response | contract error; retry disabled until refresh |

## 7. Migration Gaps

| ID | Gap |
|---|---|
| MODE-GAP-001 | Current API fallback semantics are incompatible with V2 remote mode. |
| MODE-GAP-002 | Current realtime fallback semantics are incompatible with V2 remote mode. |
| MODE-GAP-003 | Current store `apiSource: 'api' | 'mock'` is result-derived; V2 needs configured mode plus runtime status. |
| MODE-GAP-004 | RESOLVED: Production missing env values are not defaults. They are startup `ConfigurationError`s. |
