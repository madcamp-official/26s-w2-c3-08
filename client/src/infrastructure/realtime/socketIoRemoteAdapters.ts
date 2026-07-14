import {
  assetJobSchema,
  raceFinishedPayloadSchema,
  racePositionPayloadSchema,
  resultsFinalPayloadSchema,
  roomPhaseChangedPayloadSchema,
  roomStateSnapshotSchema,
  roomTimerTickPayloadSchema,
  type AssetJob,
  type RaceFinishedPayload,
  type RacePositionPayload,
  type RaceResult,
  type RealtimeRoomSnapshot,
  type RoomPhaseChangedPayload,
  type RoomTimerTickPayload,
  type Session,
} from 'shared/schemas'
import type {
  AssetJobUpdates,
  GameRealtime,
  GameRealtimeHandlers,
  RoomRealtime,
  RoomRealtimeHandlers,
  SegmentSubmittedPayload,
  TimeVoteUpdatedPayload,
  Unsubscribe,
  ValidationResultPayload,
} from '../../domain/ports'
import {
  createRealtimeError,
  createSocketIoTransport,
  toSharedRealtimeStatus,
  type SocketIoTransport,
  type SocketIoTransportOptions,
} from './socketIoTransport'
import { createProductionSocketIoClient } from './socketIoClientFactory'

export interface SocketIoRemoteRealtimeAdapters {
  transport: SocketIoTransport
  roomRealtime: RoomRealtime
  gameRealtime: GameRealtime
  assetJobUpdates: AssetJobUpdates
}

export function createSocketIoRemoteRealtimeAdapters(
  options: SocketIoTransportOptions = {},
): SocketIoRemoteRealtimeAdapters {
  const transport = createSocketIoTransport({
    socketFactory: createProductionSocketIoClient,
    ...options,
  })

  return {
    transport,
    roomRealtime: createSocketIoRoomRealtime(transport),
    gameRealtime: createSocketIoGameRealtime(transport),
    assetJobUpdates: createSocketIoAssetJobUpdates(transport),
  }
}

export function createSocketIoRoomRealtime(transport: SocketIoTransport): RoomRealtime {
  let currentHandlers: RoomRealtimeHandlers = {}
  const eventDisposers: Unsubscribe[] = []
  transport.onStatusChange((status) => {
    currentHandlers.onStatusChange?.(toSharedRealtimeStatus(status))
  })

  return {
    getStatus() {
      return toSharedRealtimeStatus(transport.getStatus())
    },
    async connect(session: Session, handlers: RoomRealtimeHandlers) {
      currentHandlers = handlers
      eventDisposers.splice(0).forEach((dispose) => dispose())
      bindRoomEvents(transport, currentHandlers, eventDisposers)
      const result = await transport.connect(session)

      if (!result.ok) {
        currentHandlers.onStatusChange?.('error')
        return {
          ok: false,
          error: result.error,
        }
      }

      return { ok: true, data: undefined }
    },
    disconnect() {
      transport.disconnect()
      eventDisposers.splice(0).forEach((dispose) => dispose())
      currentHandlers = {}
    },
    joinRoom(payload) {
      transport.emit('room:join', payload)
    },
    leaveRoom(payload) {
      transport.emit('room:leave', payload)
      transport.disconnect()
    },
    setReady(payload) {
      transport.emit('room:ready', payload)
    },
    startRoom(payload) {
      transport.emit('room:start', payload)
    },
    markPhaseReady(payload) {
      transport.emit('phase:ready', payload)
    },
    requestTimeVote(payload) {
      transport.emit('time_vote:request', payload)
    },
    submitSegment(payload) {
      transport.emit('segment:submitted', payload)
    },
    publishValidationResult(payload) {
      transport.emit('validation:completed', payload)
    },
  }
}

export function createSocketIoGameRealtime(transport: SocketIoTransport): GameRealtime {
  let currentHandlers: GameRealtimeHandlers = {}
  let eventDisposers: Unsubscribe[] = []

  return {
    getStatus() {
      return toSharedRealtimeStatus(transport.getStatus())
    },
    sendRacePosition(payload) {
      transport.emit('race:position', payload)
    },
    finishRace(payload) {
      transport.emit('race:finish', payload)
    },
    subscribe(handlers) {
      currentHandlers = handlers
      eventDisposers.forEach((dispose) => dispose())
      eventDisposers = [
        transport.on('race:position', (payload) => {
          const parsed = parseRacePosition(payload)

          if (parsed) {
            currentHandlers.onRacePosition?.(parsed)
          }
        }),
        transport.on('race:finished', (payload) => {
          const parsed = parseRaceFinished(payload)

          if (parsed) {
            currentHandlers.onRaceFinished?.(parsed)
          }
        }),
        transport.on('results:final', (payload) => {
          const parsed = parseResultsFinal(payload)

          if (parsed) {
            currentHandlers.onResultsFinal?.(parsed)
          }
        }),
      ]

      return () => {
        eventDisposers.forEach((dispose) => dispose())
        eventDisposers = []
        currentHandlers = {}
      }
    },
  }
}

export function createSocketIoAssetJobUpdates(transport: SocketIoTransport): AssetJobUpdates {
  return {
    getStatus() {
      return toSharedRealtimeStatus(transport.getStatus())
    },
    subscribe(handler) {
      return transport.on('asset_job:updated', (payload) => {
        const parsed = parseAssetJob(payload)

        if (parsed) {
          handler(parsed)
        }
      })
    },
  }
}

function bindRoomEvents(
  transport: SocketIoTransport,
  handlers: RoomRealtimeHandlers,
  disposers: Unsubscribe[],
) {
  disposers.push(
    transport.on('room:joined', (payload) => {
      const parsed = parseRoomSnapshot(payload)

      if (parsed) {
        handlers.onRoomJoined?.(parsed)
      }
    }),
    transport.on('room:state', (payload) => {
      const parsed = parseRoomSnapshot(payload)

      if (parsed) {
        handlers.onRoomStateChanged?.(parsed)
      }
    }),
    transport.on('phase:changed', (payload) => {
      const parsed = parsePhaseChanged(payload)

      if (parsed) {
        handlers.onPhaseChanged?.(parsed)
      }
    }),
    transport.on('timer:tick', (payload) => {
      const parsed = parseTimerTick(payload)

      if (parsed) {
        handlers.onTimerTick?.(parsed)
      }
    }),
    transport.on('time_vote:updated', (payload) => {
      const parsed = normalizeTimeVoteUpdated(payload)

      if (parsed) {
        handlers.onTimeVoteUpdated?.(parsed)
      }
    }),
    transport.on('segment:submitted', (payload) => {
      const parsed = normalizeSegmentSubmitted(payload)

      if (parsed) {
        handlers.onSegmentSubmitted?.(parsed)
      }
    }),
    transport.on('validation:result', (payload) => {
      const parsed = normalizeValidationResult(payload)

      if (parsed) {
        handlers.onValidationResult?.(parsed)
      }
    }),
    transport.on('map:merged', (payload) => {
      if (isRecord(payload)) {
        handlers.onMapMerged?.({
          id: readString(payload.id) ?? 'remote-map',
          roomId: readString(payload.roomId) ?? readString(payload.room_id) ?? '',
          usedFallback: payload.usedFallback === true || payload.used_fallback === true,
          createdAt: readString(payload.createdAt) ?? readString(payload.created_at) ?? new Date(0).toISOString(),
        })
      }
    }),
    transport.on('results:final', (payload) => {
      const parsed = parseResultsFinal(payload)

      if (parsed) {
        handlers.onResultsFinal?.(parsed)
      }
    }),
    transport.on('error', (payload) => {
      handlers.onStatusChange?.('error')
      void payload
    }),
  )
}

function parseRoomSnapshot(value: unknown): RealtimeRoomSnapshot | null {
  const result = roomStateSnapshotSchema.safeParse(value)

  return result.success ? result.data : null
}

function parsePhaseChanged(value: unknown): RoomPhaseChangedPayload | null {
  const result = roomPhaseChangedPayloadSchema.safeParse(value)

  return result.success ? result.data : null
}

function parseTimerTick(value: unknown): RoomTimerTickPayload | null {
  const result = roomTimerTickPayloadSchema.safeParse(value)

  return result.success ? result.data : null
}

function parseRacePosition(value: unknown): RacePositionPayload | null {
  const result = racePositionPayloadSchema.safeParse(value)

  return result.success ? result.data : null
}

function parseRaceFinished(value: unknown): RaceFinishedPayload | null {
  const result = raceFinishedPayloadSchema.safeParse(value)

  return result.success ? result.data : null
}

function parseResultsFinal(value: unknown): RaceResult | null {
  const result = resultsFinalPayloadSchema.safeParse(value)

  return result.success ? result.data : null
}

function parseAssetJob(value: unknown): AssetJob | null {
  const result = assetJobSchema.safeParse(value)

  return result.success ? result.data : null
}

function normalizeTimeVoteUpdated(value: unknown): TimeVoteUpdatedPayload | null {
  if (!isRecord(value)) {
    return null
  }

  const roomId = readString(value.roomId)
  const phase = readString(value.phase)
  const deltaSec = readNumber(value.deltaSec)

  if (!roomId || !isRoomPhase(phase) || deltaSec === null) {
    return null
  }

  return {
    roomId,
    phase,
    deltaSec,
    voterIds: readStringArray(value.voterIds),
    approved: value.approved === undefined ? true : value.approved === true,
    applied: value.applied === undefined ? true : value.applied === true,
    remainingMs: readNumber(value.remainingMs) ?? undefined,
    phaseEndsAt: readString(value.phaseEndsAt) ?? null,
  }
}

function normalizeSegmentSubmitted(value: unknown): SegmentSubmittedPayload | null {
  if (!isRecord(value)) {
    return null
  }

  const userId = readString(value.userId)
  const segmentId = readString(value.segmentId)

  if (!userId || !segmentId) {
    return null
  }

  return {
    roomId: readString(value.roomId),
    userId,
    segmentId,
  }
}

function normalizeValidationResult(value: unknown): ValidationResultPayload | null {
  if (!isRecord(value)) {
    return null
  }

  const userId = readString(value.userId)

  if (!userId || typeof value.cleared !== 'boolean') {
    return null
  }

  return {
    roomId: readString(value.roomId),
    userId,
    cleared: value.cleared,
    segmentHash: readString(value.segmentHash),
    clearTimeMs: readNumber(value.clearTimeMs) ?? undefined,
    penaltyMs: readNumber(value.penaltyMs) ?? undefined,
  }
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function isRoomPhase(value: unknown): value is TimeVoteUpdatedPayload['phase'] {
  return (
    value === 'lobby' ||
    value === 'building' ||
    value === 'validating' ||
    value === 'merging' ||
    value === 'racing' ||
    value === 'finished'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createSocketIoMissingDependencyError() {
  return createRealtimeError(
    'SOCKET_IO_CLIENT_MISSING',
    'socket.io-client dependency is required for VITE_REALTIME_MODE=remote.',
    false,
  )
}
