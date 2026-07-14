import type {
  AssetJob,
  RaceFinishedPayload,
  RacePositionPayload,
  RealtimeConnectionStatus,
  Session,
} from 'shared/schemas'
import type {
  AssetJobUpdates,
  GameRealtime,
  GameRealtimeHandlers,
  PortResult,
  RoomRealtime,
  RoomRealtimeHandlers,
  Unsubscribe,
} from '../../domain/ports'

interface BroadcastEnvelope {
  senderId: string
  eventName: string
  payload: unknown
}

export interface BroadcastChannelRealtimeOptions {
  channelName?: string
  createChannel?: (name: string) => BroadcastChannel
  senderId?: string
}

export function createBroadcastChannelRealtimeAdapters(
  options: BroadcastChannelRealtimeOptions = {},
) {
  const channel = createBroadcastChannelTransport(options)

  return {
    roomRealtime: createBroadcastChannelRoomRealtime(channel),
    gameRealtime: createBroadcastChannelGameRealtime(channel),
    assetJobUpdates: createBroadcastChannelAssetJobUpdates(channel),
  }
}

function createBroadcastChannelTransport({
  channelName = 'relay.v2.realtime.local',
  createChannel = (name) => new BroadcastChannel(name),
  senderId = `local-${Math.random().toString(36).slice(2)}`,
}: BroadcastChannelRealtimeOptions) {
  let channel: BroadcastChannel | null = null
  let status: RealtimeConnectionStatus = 'offline'
  const listeners = new Map<string, Set<(payload: unknown) => void>>()

  function ensureChannel() {
    if (channel) {
      return true
    }

    if (typeof BroadcastChannel === 'undefined' && createChannel === undefined) {
      status = 'offline'
      return false
    }

    try {
      channel = createChannel(channelName)
      channel.onmessage = (event: MessageEvent<BroadcastEnvelope>) => {
        if (!isEnvelope(event.data) || event.data.senderId === senderId) {
          return
        }

        const eventListeners = listeners.get(event.data.eventName)

        if (!eventListeners) {
          return
        }

        for (const listener of eventListeners) {
          listener(event.data.payload)
        }
      }
      status = 'connected'
      return true
    } catch {
      status = 'error'
      return false
    }
  }

  return {
    connect(): PortResult<void> {
      return ensureChannel()
        ? { ok: true, data: undefined }
        : {
            ok: false,
            error: {
              kind: 'server_unavailable',
              code: 'BROADCAST_CHANNEL_UNAVAILABLE',
              message: 'BroadcastChannel을 사용할 수 없어요.',
              retryable: false,
              source: 'realtime',
            },
          }
    },
    disconnect() {
      channel?.close()
      channel = null
      status = 'offline'
    },
    getStatus() {
      return status
    },
    emit(eventName: string, payload: unknown) {
      if (!ensureChannel()) {
        return
      }

      channel?.postMessage({ senderId, eventName, payload })
    },
    on(eventName: string, listener: (payload: unknown) => void): Unsubscribe {
      const eventListeners = listeners.get(eventName) ?? new Set<(payload: unknown) => void>()

      eventListeners.add(listener)
      listeners.set(eventName, eventListeners)

      return () => {
        eventListeners.delete(listener)
      }
    },
  }
}

type BroadcastChannelTransport = ReturnType<typeof createBroadcastChannelTransport>

function createBroadcastChannelRoomRealtime(channel: BroadcastChannelTransport): RoomRealtime {
  return {
    getStatus: () => channel.getStatus(),
    async connect(_session: Session, handlers: RoomRealtimeHandlers) {
      const result = channel.connect()

      handlers.onStatusChange?.(channel.getStatus())
      channel.on('room:joined', (payload) => handlers.onRoomJoined?.(payload as never))
      channel.on('room:state', (payload) => handlers.onRoomStateChanged?.(payload as never))
      channel.on('phase:changed', (payload) => handlers.onPhaseChanged?.(payload as never))
      channel.on('timer:tick', (payload) => handlers.onTimerTick?.(payload as never))
      channel.on('time_vote:updated', (payload) => handlers.onTimeVoteUpdated?.(payload as never))
      channel.on('segment:submitted', (payload) => handlers.onSegmentSubmitted?.(payload as never))
      channel.on('validation:result', (payload) => handlers.onValidationResult?.(payload as never))
      channel.on('map:merged', (payload) => handlers.onMapMerged?.(payload as never))
      channel.on('results:final', (payload) => handlers.onResultsFinal?.(payload as never))

      return result
    },
    disconnect: () => channel.disconnect(),
    joinRoom(payload) {
      channel.emit('room:joined', {
        roomId: payload.roomId,
        phase: 'lobby',
        phaseEndsAt: null,
        players: [
          {
            userId: payload.userId,
            nickname: payload.nickname,
            isHost: payload.isHost === true,
            isReady: payload.isHost === true,
            validationCleared: false,
            raceProgress: 0,
            raceFinishedAtMs: null,
            raceDistanceToGoal: 100,
          },
        ],
      })
    },
    leaveRoom(payload) {
      channel.emit('room:leave', payload)
    },
    setReady(payload) {
      channel.emit('room:ready', payload)
    },
    startRoom(payload) {
      channel.emit('room:start', payload)
    },
    markPhaseReady(payload) {
      channel.emit('phase:ready', payload)
    },
    requestTimeVote(payload) {
      channel.emit('time_vote:updated', {
        ...payload,
        voterIds: [payload.userId],
        approved: true,
        applied: true,
      })
    },
    submitSegment(payload) {
      channel.emit('segment:submitted', payload)
    },
    publishValidationResult(payload) {
      channel.emit('validation:result', payload)
    },
  }
}

function createBroadcastChannelGameRealtime(channel: BroadcastChannelTransport): GameRealtime {
  return {
    getStatus: () => channel.getStatus(),
    sendRacePosition(payload: RacePositionPayload) {
      channel.emit('race:position', payload)
    },
    finishRace(payload: RaceFinishedPayload) {
      channel.emit('race:finished', payload)
    },
    subscribe(handlers: GameRealtimeHandlers) {
      const disposers = [
        channel.on('race:position', (payload) => handlers.onRacePosition?.(payload as never)),
        channel.on('race:finished', (payload) => handlers.onRaceFinished?.(payload as never)),
        channel.on('results:final', (payload) => handlers.onResultsFinal?.(payload as never)),
      ]

      return () => disposers.forEach((dispose) => dispose())
    },
  }
}

function createBroadcastChannelAssetJobUpdates(channel: BroadcastChannelTransport): AssetJobUpdates {
  return {
    getStatus: () => channel.getStatus(),
    subscribe(handler) {
      return channel.on('asset_job:updated', (payload) => handler(payload as AssetJob))
    },
  }
}

function isEnvelope(value: unknown): value is BroadcastEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as BroadcastEnvelope).senderId === 'string' &&
    typeof (value as BroadcastEnvelope).eventName === 'string'
  )
}
