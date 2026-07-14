import { Client, type Room } from '@colyseus/sdk'
import type {
  Asset,
  AssetCategory,
  MapSegmentAssetSnapshot,
  MapSegmentSnapshot,
  MergedMap,
  MergedMapPlacement,
  RoomPhase,
  RoomSummary,
} from '../types/domain'
import { createClientId } from '../utils/id'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'local' | 'offline'

export interface RealtimeRoomPlayer {
  userId: string
  nickname: string
  isHost: boolean
  isReady: boolean
  validationCleared: boolean
  raceProgress: number
  raceFinishedAtMs: number | null
  raceDistanceToGoal: number
  rank?: number
}

export interface RealtimeRoomSnapshot {
  roomId: string
  phase: RoomPhase
  phaseEndsAt: string | null
  players: RealtimeRoomPlayer[]
  submittedSegmentIds?: Record<string, string>
  hasOvertime?: boolean
}

export interface RealtimePhaseChangedPayload {
  roomId: string
  phase: RoomPhase
  phaseEndsAt: string | null
  isOvertime?: boolean
}

export interface RealtimeTimerTickPayload {
  roomId: string
  phase: RoomPhase
  remainingMs: number
}

export interface RealtimeTimeVoteUpdatedPayload {
  roomId: string
  phase: RoomPhase
  deltaSec: number
  voterIds: string[]
  approved: boolean
  applied: boolean
  remainingMs?: number
  phaseEndsAt?: string | null
}

export interface RealtimeAssetJobUpdatedPayload {
  id: string
  status: string
  targetType?: string
  outputAssetId?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

export interface RealtimeValidationResultPayload {
  roomId?: string
  userId: string
  cleared: boolean
  segmentHash?: string
  clearTimeMs?: number
  penaltyMs?: number
}

export interface RealtimeRacePositionPayload {
  roomId?: string
  userId: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  state?: string
  progress?: number | null
  clientTime?: number
}

export interface RealtimeRaceFinishedPayload {
  roomId?: string
  userId: string
  finishTimeMs: number
}

export interface RealtimeHandlers {
  onStatusChange?: (status: RealtimeStatus) => void
  onRoomJoined?: (snapshot: RealtimeRoomSnapshot) => void
  onRoomState?: (snapshot: RealtimeRoomSnapshot) => void
  onPhaseChanged?: (payload: RealtimePhaseChangedPayload) => void
  onTimerTick?: (payload: RealtimeTimerTickPayload) => void
  onTimeVoteUpdated?: (payload: RealtimeTimeVoteUpdatedPayload) => void
  onSegmentSubmitted?: (payload: { roomId?: string; userId: string; segmentId: string }) => void
  onMapSegmentSnapshot?: (segment: MapSegmentSnapshot) => void
  onValidationResult?: (payload: RealtimeValidationResultPayload) => void
  onMapMerged?: (map: MergedMap) => void
  onRacePosition?: (payload: RealtimeRacePositionPayload) => void
  onRaceFinished?: (payload: RealtimeRaceFinishedPayload) => void
  onResultsFinal?: (payload: { roomId: string; players: RealtimeRoomPlayer[] }) => void
  onAssetJobUpdated?: (payload: RealtimeAssetJobUpdatedPayload) => void
  onRoomsChanged?: (payload: { rooms: RoomSummary[] }) => void
  onLobbyPlayerJoined?: (payload: {
    roomId: string
    userId: string
    nickname: string
    isHost: boolean
  }) => void
  onLobbyPlayerLeft?: (payload: { roomId: string; userId: string }) => void
  onLobbyReadyChanged?: (payload: { roomId: string; userId: string; isReady: boolean }) => void
}

const viteEnv = (import.meta.env ?? {}) as Partial<ImportMetaEnv>
const isBrowserRuntime = typeof window !== 'undefined'
const isDevRuntime = viteEnv.DEV ?? !isBrowserRuntime
const DEFAULT_COLYSEUS_URL = getDefaultColyseusUrl(isDevRuntime, isBrowserRuntime)
const COLYSEUS_URL = viteEnv.VITE_COLYSEUS_URL ?? DEFAULT_COLYSEUS_URL
const COLYSEUS_ROOM_NAME = viteEnv.VITE_COLYSEUS_ROOM_NAME ?? 'my_room'
const COLYSEUS_LATENCY_TIMEOUT_MS = 1_500
const LOCAL_REALTIME_CHANNEL = 'relay.localRealtime.v1'
const ENABLE_LOCAL_REALTIME_FALLBACK = viteEnv.VITE_LOCAL_REALTIME !== 'false'

interface LocalRealtimeEnvelope {
  senderId: string
  roomId: string
  eventName: string
  payload: unknown
  sentAt: number
}

function getDefaultColyseusUrl(isDev: boolean, isBrowser: boolean) {
  if (!isBrowser) {
    return 'ws://localhost:2567'
  }

  const runtimeLocation = window.location

  if (runtimeLocation === undefined) {
    return 'ws://localhost:2567'
  }

  const isLocalhost =
    runtimeLocation.hostname === 'localhost' ||
    runtimeLocation.hostname === '127.0.0.1' ||
    runtimeLocation.hostname === '[::1]'

  if (isDev && isLocalhost) {
    return 'ws://localhost:2567'
  }

  return `${runtimeLocation.protocol === 'https:' ? 'wss' : 'ws'}://${runtimeLocation.host}`
}

let client: Client | null = null
let room: Room | null = null
let localChannel: BroadcastChannel | null = null
let activeHandlers: RealtimeHandlers | null = null
let activeStatus: RealtimeStatus = 'idle'
let activeAppRoomId: string | null = null
let joiningAppRoomId: string | null = null
let activeLocalRoomId: string | null = null
let activeLocalUserId: string | null = null
let connectionRunId = 0
const localClientId = createClientId('local-client')

export function connectRealtime(userId: string, handlers: RealtimeHandlers) {
  disconnectRealtime()
  activeHandlers = handlers
  setupLocalRealtime(handlers)
  setStatus('connecting', handlers)

  const runId = ++connectionRunId
  client = new Client(COLYSEUS_URL, {
    headers: {
      'x-user-id': userId,
    },
  })

  client
    .getLatency({ timeout: COLYSEUS_LATENCY_TIMEOUT_MS })
    .then(() => {
      if (connectionRunId === runId && room === null) {
        setStatus('connected', handlers)
      }
    })
    .catch(() => {
      if (connectionRunId === runId && room === null) {
        setStatus(getDisconnectedRealtimeStatus(), handlers)
      }
    })
}

export function disconnectRealtime() {
  connectionRunId += 1
  room?.removeAllListeners()
  void room?.leave(true).catch(() => undefined)
  room = null
  activeAppRoomId = null
  joiningAppRoomId = null
  activeLocalRoomId = null
  activeLocalUserId = null
  localChannel?.close()
  localChannel = null
  client = null
  activeHandlers = null
  activeStatus = 'idle'
}

export function joinRealtimeRoom(
  roomId: string,
  userId: string,
  nickname: string,
  isHost = false,
) {
  const handlers = activeHandlers

  if (handlers === null) {
    return
  }

  if ((activeAppRoomId === roomId && room !== null) || joiningAppRoomId === roomId) {
    return
  }

  joinLocalRealtimeRoom(roomId, userId, nickname, isHost)
  void joinColyseusRoom(roomId, userId, nickname, handlers)
}

export function notifyRealtimeLobbyPresence(
  roomId: string,
  userId: string,
  nickname: string,
  isHost: boolean,
) {
  emitRealtime('lobby:presence', { roomId, userId, nickname, isHost })
}

export function notifyRealtimeLobbyLeave(roomId: string, userId: string) {
  emitRealtime('lobby:leave', { roomId, userId })
}

export function leaveRealtimeRoom(roomId: string, userId: string) {
  notifyRealtimeLobbyLeave(roomId, userId)

  if (activeLocalRoomId === roomId) {
    activeLocalRoomId = null
    activeLocalUserId = null
  }

  if (activeAppRoomId !== roomId && joiningAppRoomId !== roomId) {
    return
  }

  connectionRunId += 1
  joiningAppRoomId = null
  activeAppRoomId = null
  room?.removeAllListeners()
  void room?.leave(true).catch(() => undefined)
  room = null
}

export function notifyRealtimeLobbyReady(roomId: string, userId: string, isReady: boolean) {
  emitRealtime('lobby:ready', { roomId, userId, isReady })
}

export function startRealtimeRoom(roomId: string, userId: string) {
  emitRealtime('room:start', { roomId, userId })
}

export function readyRealtimePhase(roomId: string, userId: string, phase: RoomPhase) {
  emitRealtime('phase:ready', { roomId, userId, phase })
}

export function requestRealtimeTimeVote(roomId: string, userId: string, phase: RoomPhase, deltaSec: number) {
  emitRealtime('time_vote:request', { roomId, userId, phase, deltaSec })
}

export function notifyRealtimeSegmentSubmitted(roomId: string, userId: string, segmentId: string) {
  emitRealtime('segment:submitted', { roomId, userId, segmentId })
}

export function notifyRealtimeMapSegmentSnapshot(segment: MapSegmentSnapshot) {
  emitRealtime('segment:snapshot', segment)
}

export function notifyRealtimeValidationCompleted(payload: {
  roomId: string
  userId: string
  cleared: boolean
  segmentHash: string
  clearTimeMs: number
}) {
  emitRealtime('validation:completed', payload)
}

export function sendRealtimeRacePosition(payload: {
  roomId: string
  userId: string
  x: number
  y: number
  vx: number
  vy: number
  state: string
  progress: number
  clientTime: number
}) {
  emitRealtime('race:position', payload)
}

export function notifyRealtimeRaceFinish(roomId: string, userId: string, finishTimeMs: number) {
  emitRealtime('race:finish', { roomId, userId, finishTimeMs })
}

export function notifyRealtimeResultsFinal(roomId: string, players: RealtimeRoomPlayer[]) {
  emitRealtime('results:final', { roomId, players })
}

export function notifyRealtimeMapMerged(map: MergedMap) {
  emitRealtime('map:merged', map)
}

export function notifyRealtimeRoomsChanged(rooms: RoomSummary[]) {
  emitGlobalLocalRealtime('rooms:changed', { rooms })
}

export function getRealtimeStatus() {
  return activeStatus
}

async function joinColyseusRoom(
  roomId: string,
  userId: string,
  nickname: string,
  handlers: RealtimeHandlers,
) {
  const currentClient =
    client ??
    new Client(COLYSEUS_URL, {
      headers: {
        'x-user-id': userId,
      },
    })
  const runId = ++connectionRunId
  const joinOptions = {
    appRoomId: roomId,
    roomId,
    userId,
    nickname,
  }

  client = currentClient
  joiningAppRoomId = roomId
  setStatus('connecting', handlers)
  room?.removeAllListeners()
  void room?.leave(true).catch(() => undefined)
  room = null
  activeAppRoomId = null

  try {
    let joinedRoom: Room

    try {
      joinedRoom = await currentClient.joinById(roomId, joinOptions)
    } catch {
      joinedRoom = await currentClient.joinOrCreate(COLYSEUS_ROOM_NAME, joinOptions)
    }

    if (connectionRunId !== runId) {
      void joinedRoom.leave(true).catch(() => undefined)
      return
    }

    room = joinedRoom
    activeAppRoomId = roomId
    attachColyseusHandlers(joinedRoom, handlers)
    setStatus('connected', handlers)
  } catch {
    if (connectionRunId === runId) {
      setStatus(getDisconnectedRealtimeStatus(), handlers)
    }
  } finally {
    if (joiningAppRoomId === roomId) {
      joiningAppRoomId = null
    }
  }
}

function attachColyseusHandlers(joinedRoom: Room, handlers: RealtimeHandlers) {
  joinedRoom.onStateChange((state) => {
    handlers.onRoomState?.(normalizeRoomSnapshot(toPlainPayload(state)))
  })
  joinedRoom.onMessage('*', (messageType, payload) => {
    handleRealtimeMessage(String(messageType), toPlainPayload(payload), handlers)
  })
  joinedRoom.onError(() => {
    if (room === joinedRoom) {
      room = null
      activeAppRoomId = null
      setStatus(getDisconnectedRealtimeStatus(), handlers)
    }
  })
  joinedRoom.onLeave(() => {
    if (room === joinedRoom) {
      room = null
      activeAppRoomId = null
      setStatus(getDisconnectedRealtimeStatus(), handlers)
    }
  })
}

function setupLocalRealtime(handlers: RealtimeHandlers) {
  if (!ENABLE_LOCAL_REALTIME_FALLBACK || !('BroadcastChannel' in window)) {
    return
  }

  localChannel = new BroadcastChannel(LOCAL_REALTIME_CHANNEL)
  localChannel.onmessage = (event: MessageEvent<unknown>) => {
    const envelope = normalizeLocalRealtimeEnvelope(event.data)

    if (
      envelope === null ||
      envelope.senderId === localClientId ||
      (envelope.roomId !== '*' && envelope.roomId !== activeLocalRoomId)
    ) {
      return
    }

    handleRealtimeMessage(envelope.eventName, envelope.payload, handlers)
  }
}

function joinLocalRealtimeRoom(
  roomId: string,
  userId: string,
  nickname: string,
  isHost: boolean,
) {
  activeLocalRoomId = roomId
  activeLocalUserId = userId
  emitLocalRealtime('room:join', { roomId, userId, nickname, isHost })
}

function handleRealtimeMessage(eventName: string, payload: unknown, handlers: RealtimeHandlers) {
  if (eventName === 'room:joined') {
    handlers.onRoomJoined?.(normalizeRoomSnapshot(payload))
    return
  }

  if (eventName === 'room:state') {
    handlers.onRoomState?.(normalizeRoomSnapshot(payload))
    return
  }

  if (eventName === 'phase:changed') {
    handlers.onPhaseChanged?.(normalizePhasePayload(payload))
    return
  }

  if (eventName === 'timer:tick') {
    handlers.onTimerTick?.(normalizeTimerTick(payload))
    return
  }

  if (eventName === 'time_vote:updated') {
    handlers.onTimeVoteUpdated?.(normalizeTimeVotePayload(payload))
    return
  }

  if (eventName === 'segment:submitted') {
    const value = isRecord(payload) ? payload : {}
    const userIdValue = readString(value.userId) ?? readString(value.user_id)
    const segmentId = readString(value.segmentId) ?? readString(value.segment_id)

    if (userIdValue !== null && segmentId !== null) {
      handlers.onSegmentSubmitted?.({
        roomId: readString(value.roomId) ?? readString(value.room_id) ?? undefined,
        userId: userIdValue,
        segmentId,
      })
    }

    return
  }

  if (eventName === 'segment:snapshot') {
    handlers.onMapSegmentSnapshot?.(normalizeMapSegmentSnapshot(payload))
    return
  }

  if (eventName === 'validation:result') {
    const value = isRecord(payload) ? payload : {}
    const userIdValue = readString(value.userId) ?? readString(value.user_id)

    if (userIdValue !== null) {
      handlers.onValidationResult?.({
        roomId: readString(value.roomId) ?? readString(value.room_id) ?? undefined,
        userId: userIdValue,
        cleared: value.cleared === true,
        segmentHash: readString(value.segmentHash) ?? readString(value.segment_hash) ?? undefined,
        clearTimeMs: readNumber(value.clearTimeMs) ?? readNumber(value.clear_time_ms) ?? undefined,
        penaltyMs: readNumber(value.penaltyMs) ?? readNumber(value.penalty_ms) ?? undefined,
      })
    }

    return
  }

  if (eventName === 'map:merged') {
    handlers.onMapMerged?.(normalizeMergedMap(payload))
    return
  }

  if (eventName === 'race:position') {
    const value = isRecord(payload) ? payload : {}
    const userIdValue = readString(value.userId) ?? readString(value.user_id)

    if (userIdValue !== null) {
      handlers.onRacePosition?.({
        roomId: readString(value.roomId) ?? readString(value.room_id) ?? undefined,
        userId: userIdValue,
        x: readNumber(value.x) ?? undefined,
        y: readNumber(value.y) ?? undefined,
        vx: readNumber(value.vx) ?? undefined,
        vy: readNumber(value.vy) ?? undefined,
        state: readString(value.state) ?? undefined,
        progress: readNumber(value.progress),
        clientTime: readNumber(value.clientTime) ?? readNumber(value.client_time) ?? undefined,
      })
    }

    return
  }

  if (eventName === 'race:finished') {
    const value = isRecord(payload) ? payload : {}
    const userIdValue = readString(value.userId) ?? readString(value.user_id)
    const finishTimeMs = readNumber(value.finishTimeMs) ?? readNumber(value.finish_time_ms)

    if (userIdValue !== null && finishTimeMs !== null) {
      handlers.onRaceFinished?.({
        roomId: readString(value.roomId) ?? readString(value.room_id) ?? undefined,
        userId: userIdValue,
        finishTimeMs,
      })
    }

    return
  }

  if (eventName === 'results:final') {
    const value = isRecord(payload) ? payload : {}

    handlers.onResultsFinal?.({
      roomId: readString(value.roomId) ?? readString(value.room_id) ?? '',
      players: Array.isArray(value.players)
        ? value.players.map(normalizeRoomPlayer)
        : [],
    })

    return
  }

  if (eventName === 'asset_job:updated') {
    handlers.onAssetJobUpdated?.(normalizeAssetJobPayload(payload))
    return
  }

  if (eventName === 'rooms:changed') {
    handlers.onRoomsChanged?.(normalizeRoomsChangedPayload(payload))
    return
  }

  if (eventName === 'lobby:player_joined') {
    const value = isRecord(payload) ? payload : {}
    const roomId = readString(value.roomId) ?? readString(value.room_id)
    const userId = readString(value.userId) ?? readString(value.user_id)
    const nickname = readString(value.nickname)

    if (roomId !== null && userId !== null && nickname !== null) {
      handlers.onLobbyPlayerJoined?.({
        roomId,
        userId,
        nickname,
        isHost: value.isHost === true || value.is_host === true,
      })
    }

    return
  }

  if (eventName === 'lobby:ready') {
    const value = isRecord(payload) ? payload : {}
    const roomId = readString(value.roomId) ?? readString(value.room_id)
    const userId = readString(value.userId) ?? readString(value.user_id)

    if (roomId !== null && userId !== null) {
      handlers.onLobbyReadyChanged?.({
        roomId,
        userId,
        isReady: value.isReady === true || value.is_ready === true,
      })
    }

    return
  }

  if (eventName === 'lobby:leave') {
    const value = isRecord(payload) ? payload : {}
    const roomId = readString(value.roomId) ?? readString(value.room_id)
    const userId = readString(value.userId) ?? readString(value.user_id)

    if (roomId !== null && userId !== null) {
      handlers.onLobbyPlayerLeft?.({ roomId, userId })
    }
  }
}

function emitRealtime(eventName: string, payload: unknown) {
  emitLocalRealtime(eventName, payload)

  if (room === null) {
    return
  }

  room.send(eventName, payload)
}

function emitLocalRealtime(eventName: string, payload: unknown) {
  if (localChannel === null || activeLocalRoomId === null) {
    return
  }

  const translatedEvent = translateLocalRealtimeEvent(eventName, payload)

  if (translatedEvent === null) {
    return
  }

  localChannel.postMessage({
    senderId: localClientId,
    roomId: activeLocalRoomId,
    eventName: translatedEvent.eventName,
    payload: translatedEvent.payload,
    sentAt: Date.now(),
  } satisfies LocalRealtimeEnvelope)
}

function emitGlobalLocalRealtime(eventName: string, payload: unknown) {
  if (localChannel === null) {
    return
  }

  localChannel.postMessage({
    senderId: localClientId,
    roomId: '*',
    eventName,
    payload,
    sentAt: Date.now(),
  } satisfies LocalRealtimeEnvelope)
}

function translateLocalRealtimeEvent(eventName: string, payload: unknown) {
  if (eventName === 'room:join') {
    return {
      eventName: 'lobby:player_joined',
      payload,
    }
  }

  if (eventName === 'lobby:presence') {
    return {
      eventName: 'lobby:player_joined',
      payload,
    }
  }

  if (eventName === 'phase:ready') {
    const value = isRecord(payload) ? payload : {}
    const phase = normalizePhase(value.phase)

    return {
      eventName: 'phase:changed',
      payload: {
        roomId: readString(value.roomId) ?? readString(value.room_id) ?? activeLocalRoomId,
        phase,
        phaseEndsAt: null,
      },
    }
  }

  if (eventName === 'time_vote:request') {
    const value = isRecord(payload) ? payload : {}
    const userId = readString(value.userId) ?? readString(value.user_id) ?? activeLocalUserId

    return {
      eventName: 'time_vote:updated',
      payload: {
        roomId: readString(value.roomId) ?? readString(value.room_id) ?? activeLocalRoomId,
        phase: normalizePhase(value.phase),
        deltaSec: readNumber(value.deltaSec) ?? readNumber(value.delta_sec) ?? 0,
        voterIds: userId === null ? [] : [userId],
        approved: false,
        applied: false,
      },
    }
  }

  if (eventName === 'validation:completed') {
    return {
      eventName: 'validation:result',
      payload,
    }
  }

  if (eventName === 'race:finish') {
    return {
      eventName: 'race:finished',
      payload,
    }
  }

  if (
    eventName === 'segment:submitted' ||
    eventName === 'segment:snapshot' ||
    eventName === 'lobby:ready' ||
    eventName === 'lobby:leave' ||
    eventName === 'race:position' ||
    eventName === 'map:merged' ||
    eventName === 'results:final'
  ) {
    return { eventName, payload }
  }

  return null
}

function setStatus(status: RealtimeStatus, handlers: RealtimeHandlers) {
  activeStatus = status
  handlers.onStatusChange?.(status)
}

function getDisconnectedRealtimeStatus(): RealtimeStatus {
  return localChannel === null ? 'offline' : 'local'
}

function normalizeRoomSnapshot(payload: unknown): RealtimeRoomSnapshot {
  const plainPayload = toPlainPayload(payload)
  const value = isRecord(plainPayload) ? plainPayload : {}
  const submittedSegmentIds = value.submittedSegmentIds ?? value.submitted_segment_ids

  return {
    roomId: readString(value.roomId) ?? readString(value.room_id) ?? readString(value.id) ?? '',
    phase: normalizePhase(value.phase),
    phaseEndsAt: readString(value.phaseEndsAt) ?? readString(value.phase_ends_at),
    players: Array.isArray(value.players) ? value.players.map(normalizeRoomPlayer) : [],
    submittedSegmentIds: isRecord(submittedSegmentIds)
      ? Object.fromEntries(
          Object.entries(submittedSegmentIds).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : undefined,
    hasOvertime: value.hasOvertime === true || value.has_overtime === true,
  }
}

function normalizeRoomPlayer(payload: unknown): RealtimeRoomPlayer {
  const value = isRecord(payload) ? payload : {}
  const userId = readString(value.userId) ?? readString(value.user_id) ?? readString(value.id) ?? ''
  const raceProgress = readNumber(value.raceProgress) ?? readNumber(value.race_progress) ?? 0

  return {
    userId,
    nickname: readString(value.nickname) ?? `player-${userId.slice(0, 4)}`,
    isHost: value.isHost === true || value.is_host === true,
    isReady:
      value.isReady === true ||
      value.is_ready === true ||
      value.isHost === true ||
      value.is_host === true,
    validationCleared: value.validationCleared === true || value.validation_cleared === true,
    raceProgress,
    raceFinishedAtMs:
      readNumber(value.raceFinishedAtMs) ??
      readNumber(value.race_finished_at_ms) ??
      readNumber(value.finishTimeMs) ??
      readNumber(value.finish_time_ms),
    raceDistanceToGoal:
      readNumber(value.raceDistanceToGoal) ??
      readNumber(value.race_distance_to_goal) ??
      Math.max(0, 100 - raceProgress),
    rank: readNumber(value.rank) ?? undefined,
  }
}

function normalizePhasePayload(payload: unknown): RealtimePhaseChangedPayload {
  const value = isRecord(payload) ? payload : {}

  return {
    roomId: readString(value.roomId) ?? readString(value.room_id) ?? '',
    phase: normalizePhase(value.phase),
    phaseEndsAt: readString(value.phaseEndsAt) ?? readString(value.phase_ends_at),
    isOvertime: value.isOvertime === true || value.is_overtime === true,
  }
}

function normalizeTimerTick(payload: unknown): RealtimeTimerTickPayload {
  const value = isRecord(payload) ? payload : {}

  return {
    roomId: readString(value.roomId) ?? readString(value.room_id) ?? '',
    phase: normalizePhase(value.phase),
    remainingMs: readNumber(value.remainingMs) ?? readNumber(value.remaining_ms) ?? 0,
  }
}

function normalizeTimeVotePayload(payload: unknown): RealtimeTimeVoteUpdatedPayload {
  const value = isRecord(payload) ? payload : {}
  const rawVoterIds = value.voterIds ?? value.voter_ids

  return {
    roomId: readString(value.roomId) ?? readString(value.room_id) ?? '',
    phase: normalizePhase(value.phase),
    deltaSec: readNumber(value.deltaSec) ?? readNumber(value.delta_sec) ?? 0,
    voterIds: Array.isArray(rawVoterIds)
      ? rawVoterIds.map((voterId) => readString(voterId)).filter((voterId): voterId is string => voterId !== null)
      : [],
    approved: value.approved === true,
    applied: value.applied === true,
    remainingMs: readNumber(value.remainingMs) ?? readNumber(value.remaining_ms) ?? undefined,
    phaseEndsAt: readString(value.phaseEndsAt) ?? readString(value.phase_ends_at),
  }
}

function normalizeAssetJobPayload(payload: unknown): RealtimeAssetJobUpdatedPayload {
  const value = isRecord(payload) ? payload : {}

  return {
    id: readString(value.id) ?? readString(value.jobId) ?? readString(value.job_id) ?? '',
    status: readString(value.status) ?? 'UNKNOWN',
    targetType: readString(value.targetType) ?? readString(value.target_type) ?? undefined,
    outputAssetId:
      readString(value.outputAssetId) ?? readString(value.output_asset_id) ?? undefined,
    errorCode: readString(value.errorCode) ?? readString(value.error_code),
    errorMessage: readString(value.errorMessage) ?? readString(value.error_message),
  }
}

function normalizeRoomsChangedPayload(payload: unknown) {
  const value = isRecord(payload) ? payload : {}
  const rawRooms = value.rooms

  return {
    rooms: Array.isArray(rawRooms) ? rawRooms.map(normalizeRoomSummary) : [],
  }
}

function normalizeRoomSummary(payload: unknown): RoomSummary {
  const value = isRecord(payload) ? payload : {}

  return {
    id: readString(value.id) ?? createClientId('room'),
    name: readString(value.name) ?? '릴레이 방',
    hostId:
      readString(value.hostId) ??
      readString(value.host_id) ??
      readString(value.hostUserId) ??
      readString(value.host_user_id) ??
      readString(value.ownerId) ??
      readString(value.owner_id),
    hostNickname:
      readString(value.hostNickname) ?? readString(value.host_nickname) ?? 'host',
    isPublic: value.isPublic === true || value.is_public === true,
    players: readNumber(value.players) ?? readNumber(value.currentPlayers) ?? 1,
    maxPlayers: readNumber(value.maxPlayers) ?? readNumber(value.max_players) ?? 4,
    phase: normalizePhase(value.phase),
    elapsedSeconds: readNumber(value.elapsedSeconds) ?? readNumber(value.elapsed_seconds) ?? 0,
    phaseEndsAt: readString(value.phaseEndsAt) ?? readString(value.phase_ends_at) ?? null,
  }
}

function normalizeMergedMap(payload: unknown): MergedMap {
  const value = isRecord(payload) ? payload : {}
  const rawPlacements = value.placements ?? value.assets
  const rawSegments = value.segments

  return {
    id: readString(value.id) ?? readString(value.mapId) ?? readString(value.map_id) ?? 'merged-map',
    roomId: readString(value.roomId) ?? readString(value.room_id) ?? '',
    globalStart: normalizePoint(value.globalStart ?? value.global_start),
    globalEnd: normalizePoint(value.globalEnd ?? value.global_end),
    placements: Array.isArray(rawPlacements)
      ? rawPlacements.map(normalizeMergedPlacement)
      : [],
    segments: Array.isArray(rawSegments) ? rawSegments.map(normalizeMergedSegment) : [],
    usedFallback: value.usedFallback === true || value.used_fallback === true,
    createdAt: readString(value.createdAt) ?? readString(value.created_at) ?? new Date().toISOString(),
  }
}

function normalizeMergedPlacement(payload: unknown): MergedMapPlacement {
  const value = isRecord(payload) ? payload : {}

  return {
    assetId: readString(value.assetId) ?? readString(value.asset_id) ?? 'unknown-asset',
    assetCategory: normalizeAssetCategory(value.assetCategory ?? value.asset_category ?? value.type),
    assetAttrs: normalizeAssetAttrs(value.assetAttrs ?? value.asset_attrs),
    colliderType: normalizeColliderType(value.colliderType ?? value.collider_type),
    sourceSegmentId:
      readString(value.sourceSegmentId) ??
      readString(value.source_segment_id) ??
      readString(value.segmentId) ??
      readString(value.segment_id) ??
      'server-segment',
    x: readNumber(value.x) ?? 0,
    y: readNumber(value.y) ?? 0,
    widthCells: readNumber(value.widthCells) ?? readNumber(value.width_cells) ?? 1,
    heightCells: readNumber(value.heightCells) ?? readNumber(value.height_cells) ?? 1,
    rotation: readNumber(value.rotation) ?? 0,
  }
}

function normalizeMergedSegment(payload: unknown): MapSegmentSnapshot {
  return normalizeMapSegmentSnapshot(payload)
}

function normalizeMapSegmentSnapshot(payload: unknown): MapSegmentSnapshot {
  const value = isRecord(payload) ? payload : {}
  const rawAssetRefs = value.assetRefs ?? value.asset_refs ?? value.assets

  return {
    id:
      readString(value.id) ??
      readString(value.segmentId) ??
      readString(value.segment_id) ??
      createClientId('segment'),
    roomId: readString(value.roomId) ?? readString(value.room_id) ?? '',
    creatorId: readString(value.creatorId) ?? readString(value.creator_id) ?? '',
    startPoint: normalizePoint(value.startPoint ?? value.start_point),
    endPoint: normalizePoint(value.endPoint ?? value.end_point),
    placements: [],
    assetRefs: Array.isArray(rawAssetRefs) ? rawAssetRefs.map(normalizeSegmentAssetRef) : [],
    segmentHash: readString(value.segmentHash) ?? readString(value.segment_hash) ?? '',
    isValidated: value.isValidated === true || value.is_validated === true,
    submittedAt: readString(value.submittedAt) ?? readString(value.submitted_at) ?? '',
    validatedAt: readString(value.validatedAt) ?? readString(value.validated_at),
    clearTimeMs: readNumber(value.clearTimeMs) ?? readNumber(value.clear_time_ms),
  }
}

function normalizeSegmentAssetRef(payload: unknown): MapSegmentAssetSnapshot {
  const value = isRecord(payload) ? payload : {}

  return {
    assetId: readString(value.assetId) ?? readString(value.asset_id) ?? 'unknown-asset',
    assetCategory: normalizeAssetCategory(value.assetCategory ?? value.asset_category ?? value.type),
    assetAttrs: normalizeAssetAttrs(value.assetAttrs ?? value.asset_attrs),
    colliderType: normalizeColliderType(value.colliderType ?? value.collider_type),
    x: readNumber(value.x) ?? 0,
    y: readNumber(value.y) ?? 0,
    widthCells: readNumber(value.widthCells) ?? readNumber(value.width_cells) ?? 1,
    heightCells: readNumber(value.heightCells) ?? readNumber(value.height_cells) ?? 1,
    rotation: readNumber(value.rotation) ?? 0,
  }
}

function normalizePoint(payload: unknown) {
  const value = isRecord(payload) ? payload : {}

  return {
    x: readNumber(value.x) ?? 0,
    y: readNumber(value.y) ?? 0,
  }
}

function normalizeAssetAttrs(attrs: unknown): Asset['attrs'] | undefined {
  if (!isRecord(attrs)) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(attrs).filter(
      (entry): entry is [string, string | number | boolean | null] =>
        typeof entry[1] === 'string' ||
        typeof entry[1] === 'number' ||
        typeof entry[1] === 'boolean' ||
        entry[1] === null,
    ),
  )
}

function normalizeAssetCategory(category: unknown): AssetCategory | undefined {
  const normalized = String(category ?? '').toLowerCase()

  if (normalized === 'avatar') {
    return 'avatar'
  }

  if (normalized === 'terrain' || normalized === 'platform') {
    return 'platform'
  }

  if (normalized === 'enemy' || normalized === 'monster') {
    return 'monster'
  }

  if (normalized === 'item') {
    return 'item'
  }

  if (normalized === 'background') {
    return 'background'
  }

  if (normalized === 'device' || normalized === 'obstacle') {
    return 'obstacle'
  }

  return undefined
}

function normalizeColliderType(colliderType: unknown): Asset['colliderType'] | undefined {
  const normalized = String(colliderType ?? '').toLowerCase()

  if (normalized.includes('none') || normalized.includes('decorative')) {
    return 'none'
  }

  if (normalized.includes('slope')) {
    return 'slope'
  }

  if (normalized.length > 0) {
    return 'rect'
  }

  return undefined
}

function normalizePhase(phase: unknown): RoomPhase {
  const normalized = typeof phase === 'string' ? phase.toLowerCase() : ''

  if (
    normalized === 'building' ||
    normalized === 'validating' ||
    normalized === 'merging' ||
    normalized === 'racing' ||
    normalized === 'finished'
  ) {
    return normalized
  }

  return 'lobby'
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsedValue = Number(value)

    return Number.isFinite(parsedValue) ? parsedValue : null
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toPlainPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload
  }

  const toJSON = payload.toJSON

  if (typeof toJSON === 'function') {
    return toJSON.call(payload)
  }

  return payload
}

function normalizeLocalRealtimeEnvelope(payload: unknown): LocalRealtimeEnvelope | null {
  if (!isRecord(payload)) {
    return null
  }

  const senderId = readString(payload.senderId)
  const roomId = readString(payload.roomId)
  const eventName = readString(payload.eventName)
  const sentAt = readNumber(payload.sentAt)

  if (senderId === null || roomId === null || eventName === null || sentAt === null) {
    return null
  }

  return {
    senderId,
    roomId,
    eventName,
    payload: payload.payload,
    sentAt,
  }
}
