# Frontend V2 Realtime Contract

작성일: 2026-07-13  
목적: V2 realtime을 AssetJobUpdates, RoomRealtime, GameRealtime으로 분리한다.

## 1. Principles

- V2 MVP remote realtime은 `backend/` Socket.IO 계약을 우선한다.
- `server/` Colyseus는 production-ready가 확인되기 전까지 대체 transport 후보로만 문서화한다.
- UI와 feature 계층은 Socket.IO, Colyseus, BroadcastChannel을 직접 import하지 않는다.
- `VITE_REALTIME_MODE=local|remote`가 transport mode를 결정한다.
- remote 실패 시 BroadcastChannel 자동 fallback은 금지한다.

## 2. Domain: AssetJobUpdates

| Semantic event name | Current transport event | Payload | Sender | Receiver | Authoritative source | Reconnect behavior | Idempotency | Source evidence |
|---|---|---|---|---|---|---|---|---|
| `assetJob.updated` | `asset_job:updated` over backend Socket.IO | `{ id, status, targetType, outputAssetId, action?, errorCode?, errorMessage?, updatedAtMs }` | backend asset worker result/claim path | asset store/controller | backend asset state in `apiRoutes.ts` | on reconnect call `/api/asset-jobs` or `/api/assets/generation-jobs/:jobId`; limited job polling allowed | idempotent by `id` and monotonic status | `backend/src/socket/index.ts`, `apiRoutes.ts emitAssetJobUpdated`, backend socket contract test |
| `assetJob.polled` | REST fallback, no socket event | `AssetJobSnapshot` via `/api/assets/generation-jobs/:jobId` or session-wide jobs via `/api/asset-jobs` | API adapter | asset store | backend API | only while working asset/job exists, >=5s interval | idempotent by asset/job id | `apiRoutes.ts /assets/generation-jobs/:jobId`, `/api/asset-jobs`, backend contract test |

TBD-CONTRACT:

- Final job status enum mapping between backend `queued/generating/ready/failed` and LSJ `PENDING/REFINING_PROMPT/GENERATING_SPRITE/DONE/FAILED/PENDING_RETRY` needs adapter mapping if LSJ enum names are exposed externally.

## 3. Domain: RoomRealtime

| Semantic event name | Current transport event | Payload | Sender | Receiver | Authoritative source | Reconnect behavior | Idempotency | Source evidence |
|---|---|---|---|---|---|---|---|---|
| `room.join` | client emits `room:join`; current frontend Colyseus local emits translated `room:join`; backend Socket.IO listens | `{ roomId, userId, nickname? }` | client controller | backend realtime | backend room state | reconnect sends join for current room | idempotent by `(roomId,userId)` | `backend/src/socket/index.ts room:join`, `realtime.ts joinLocalRealtimeRoom` |
| `room.joined` | `room:joined` | `RealtimeRoomSnapshot` | backend realtime | client store | backend room state | latest snapshot replaces local state | idempotent by room id and phase | `backend/src/socket/index.ts socket.emit`, `realtime.ts onRoomJoined` |
| `room.stateChanged` | `room:state` | `{ roomId, phase, phaseEndsAt, players, submittedSegmentIds?, hasOvertime? }` | backend realtime | client store | backend room state | latest snapshot wins | idempotent full snapshot | `toRoomSnapshot`, `normalizeRoomSnapshot` |
| `room.playerPresenceChanged` | current frontend handles `lobby:player_joined`, `lobby:leave`; backend mostly emits full `room:state` | join/leave payload or full snapshot | clients/backend | client store | backend room state in remote mode | rely on `room:state` on reconnect | idempotent by user id | `realtime.ts handleRealtimeMessage`, `backend socket disconnect` |
| `room.readyChanged` | `room:ready`; backend emits full `room:state` | `{ roomId, userId, isReady }` | client/backend | room clients | backend room state and API room snapshot | full room snapshot required; reconnect can refetch REST room snapshot | idempotent by `(phase,userId,isReady)` | `socketIoRemoteAdapters`, `backend socket room:ready`, `setApiRoomReadyFromRealtime`, backend socket contract test |
| `room.startRequested` | `room:start` | `{ roomId, userId }` | host client | backend realtime | backend phase machine | host may retry; backend ignores invalid phase | idempotent by current phase | `backend socket room:start`, `appStore.advanceRoomPhase` |
| `room.phaseChanged` | `phase:changed` | `{ roomId, phase, phaseEndsAt, isOvertime? }` | backend realtime | client store | backend phase machine and API room snapshot | latest event/snapshot wins; REST refetch sees the same phase timer when Socket.IO advances a phase | idempotent by phase and `phaseEndsAt` | `backend startPhase`, `setApiRoomPhase`, `realtime.ts normalizePhasePayload`, backend socket contract test |
| `room.timerTick` | `timer:tick` | `{ roomId, phase, remainingMs }` | backend timer | client store | backend timer | resume from latest tick or phase snapshot | idempotent latest value | `backend tickRoomTimer`, `realtime.ts normalizeTimerTick` |
| `room.timeVoteRequested` | `time_vote:request` | `{ roomId, userId, phase, deltaSec }` | client | backend realtime | backend vote state `TBD-CONTRACT` | user may retry once per phase | idempotency key missing; use `(roomId,phase,userId,deltaSec)` | `requestRealtimeTimeVote`, `backend time_vote:request` |
| `room.timeVoteUpdated` | `time_vote:updated` | `{ roomId, phase, deltaSec, voterIds?, approved?, applied?, remainingMs?, phaseEndsAt? }` | backend realtime | client store | backend vote state | latest update wins | idempotent by voter set | `realtime.ts RealtimeTimeVoteUpdatedPayload`, backend currently emits partial |
| `room.segmentSubmitted` | `segment:submitted` | `{ roomId, userId, segmentId }` | client/backend | room clients | REST segment save + backend room state | full `submittedSegmentIds` snapshot on reconnect | idempotent by `(roomId,userId,segmentId)` | `notifyRealtimeSegmentSubmitted`, `backend segment:submitted` |
| `room.segmentSnapshot` | `segment:snapshot` | `MapSegmentSnapshot` | client local/fallback; remote authority `TBD-CONTRACT` | room clients | REST/API should own final data | refetch segments `TBD-CONTRACT`; currently snapshot event only | idempotent by `segment.id` or `(roomId,creatorId,segmentHash)` | `notifyRealtimeMapSegmentSnapshot`, frontend handler |
| `room.validationResult` | `validation:completed` client emit; `validation:result` server event | `{ roomId, userId, cleared, segmentHash?, clearTimeMs?, penaltyMs? }` | client submit/backend broadcast | room clients | backend validation record | latest result wins; REST validation is source | idempotent by `(roomId,userId,segmentHash)` | `backend validation:completed`, `validateCurrentSegment` |
| `room.mapMerged` | `map:merged` | `MergedMap` | backend merge or local fallback | room clients | backend merge for remote mode | if missing, call merge endpoint or wait phase snapshot | idempotent by `mergedMap.id` | `backend startPhase`, `notifyRealtimeMapMerged` |
| `room.resultsFinal` | `results:final` | `{ roomId, players: RealtimeRoomPlayer[] }` | backend phase machine | room clients | backend race result | latest final result wins | idempotent by room id and ranks | `backend startPhase finished`, `notifyRealtimeResultsFinal` |
| `rooms.changed` | `rooms:changed` local only | `{ rooms: RoomSummary[] }` | local mock clients | lobby stores | mock storage only | not used in remote mode | full snapshot | `notifyRealtimeRoomsChanged`, `realtime.ts` |

## 4. Domain: GameRealtime

| Semantic event name | Current transport event | Payload | Sender | Receiver | Authoritative source | Reconnect behavior | Idempotency | Source evidence |
|---|---|---|---|---|---|---|---|---|
| `game.racePositionSent` | `race:position` | `{ roomId, userId, x, y, vx, vy, state, progress, clientTime }` | racing client | backend realtime | client-authoritative position in MVP | remote positions marked stale until next event | last clientTime/progress wins | `RaceCanvas onProgress`, `sendRealtimeRacePosition`, `backend race:position` |
| `game.racePositionReceived` | `race:position` | same as above | backend broadcast | other clients | emitting client through backend | stale if no update; no replay required | idempotent latest by `userId` | `backend socket.to(...).emit`, `realtime.ts onRacePosition` |
| `game.raceFinished` | client emits `race:finish`; server emits `race:finished` | `{ roomId, userId, finishTimeMs }` | client/backend | room clients | backend should keep minimum finish time | if disconnected after finish, results final should include finish | idempotent by min finish time | `backend race:finish`, `appStore.recordRaceFinish` |
| `game.overtimeChanged` | `phase:changed` with `isOvertime: true` | `{ roomId, phase:'racing', phaseEndsAt, isOvertime:true }` | backend timer | room clients | backend timer | latest phase snapshot wins | idempotent by phaseEndsAt | `backend tickRoomTimer`, `RacePhase isRaceOvertime` |
| `game.phaseReady` | `phase:ready` | `{ roomId, userId, phase }` | client | backend/clients | backend phase readiness `TBD-CONTRACT` | no replay requirement | idempotent by `(userId,phase)` | `readyRealtimePhase`; backend currently echoes `phase:ready` |

TBD-CONTRACT:

- PvP stomp, freeze penalty, and collision gameplay are currently Phaser-owned and not realtime-authoritative.
- Server-side anti-cheat/physics validation is out of MVP scope.
- Reconnect replay for map segments and race results requires backend snapshot endpoints if remote hardening is needed.

## 5. Transport Policy

| Mode | Contract |
|---|---|
| `VITE_REALTIME_MODE=local` | Use local realtime implementation for local/mock development only. BroadcastChannel is allowed only when mode is explicit `local`. |
| `VITE_REALTIME_MODE=remote` | Use backend Socket.IO. Connection failure sets typed realtime error/offline state. No automatic BroadcastChannel fallback. |
| Colyseus | Alternative transport candidate only. Current `server/src/rooms/MyRoom.ts` does not implement production protocol. |

## 6. Migration Gaps

| ID | Gap |
|---|---|
| RT-GAP-001 | RESOLVED for V2 entry: remote realtime uses `socket.io-client` through `createSocketIoRemoteRealtimeAdapters`; `@colyseus/sdk` remains only in legacy realtime code until legacy removal. |
| RT-GAP-002 | RESOLVED for V2 entry: `resolveV2ModeConfig` reads `VITE_REALTIME_MODE`; legacy `VITE_LOCAL_REALTIME` remains only in legacy realtime code until removal. |
| RT-GAP-003 | RESOLVED: backend emits `asset_job:updated` from API asset job state changes through Socket.IO. |
| RT-GAP-004 | RESOLVED for V2 remote MVP: backend uses full `room:state` for presence/ready sync, and `room:ready` persists readiness into the API room snapshot. Fine-grained local-only lobby events are legacy/dev conveniences. |
| RT-GAP-005 | RESOLVED for V2 entry: remote realtime errors surface status/error and do not select BroadcastChannel fallback. |
