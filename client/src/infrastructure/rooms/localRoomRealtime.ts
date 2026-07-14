import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  RoomRealtime,
  RoomRealtimeHandlers,
  RoomRealtimeSnapshot,
} from '../../pages/room/roomControllerCore'

interface RoomRealtimeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface LocalRoomRealtimeOptions {
  storage?: RoomRealtimeStorage
  createChannel?: (name: string) => BroadcastChannel
  channelName?: string
  senderId?: string
}

interface RoomRealtimeEnvelope {
  senderId: string
  type: 'room-state' | 'player-joined' | 'player-left' | 'ready-changed' | 'phase-changed'
  payload: unknown
}

const snapshotStorageKey = 'relay.v2.local.room-snapshots'

export function createLocalRoomRealtime({
  storage = getDefaultStorage(),
  createChannel = (name) => new BroadcastChannel(name),
  channelName = 'relay.v2.rooms.local',
  senderId = `room-${Math.random().toString(36).slice(2)}`,
}: LocalRoomRealtimeOptions = {}): RoomRealtime {
  let channel: BroadcastChannel | null = null
  let handlers: RoomRealtimeHandlers = {}
  let status: ReturnType<RoomRealtime['getConnectionStatus']> = { status: 'online' }

  function publish(type: RoomRealtimeEnvelope['type'], payload: unknown) {
    const envelope: RoomRealtimeEnvelope = { senderId, type, payload }

    handleEnvelope(envelope, true)
    channel?.postMessage(envelope)
  }

  function handleEnvelope(envelope: RoomRealtimeEnvelope, fromSelf = false) {
    if (!fromSelf && envelope.senderId === senderId) {
      return
    }

    if (envelope.type === 'room-state' && isRoomRealtimeSnapshot(envelope.payload)) {
      saveSnapshot(storage, envelope.payload)
      handlers.onRoomStateChanged?.(envelope.payload)
      return
    }

    if (envelope.type === 'player-joined' && isPlayerJoinedPayload(envelope.payload)) {
      const payload = envelope.payload
      const snapshot = upsertPlayer(loadSnapshot(storage, payload.roomId), {
        userId: payload.userId,
        nickname: payload.nickname,
        isHost: payload.isHost,
        isReady: payload.isHost,
      })

      saveSnapshot(storage, snapshot)
      handlers.onRoomStateChanged?.(snapshot)

      if (!fromSelf) {
        publish('room-state', snapshot)
      }

      return
    }

    if (envelope.type === 'player-left' && isPlayerLeftPayload(envelope.payload)) {
      const payload = envelope.payload
      const currentSnapshot = loadSnapshot(storage, payload.roomId)
      const snapshot = ensureHost({
        ...currentSnapshot,
        players: currentSnapshot.players.filter((player) => player.userId !== payload.userId),
      })

      saveSnapshot(storage, snapshot)
      handlers.onRoomStateChanged?.(snapshot)

      if (!fromSelf) {
        publish('room-state', snapshot)
      }

      return
    }

    if (envelope.type === 'ready-changed' && isReadyChangedPayload(envelope.payload)) {
      const payload = envelope.payload
      const currentSnapshot = loadSnapshot(storage, payload.roomId)
      const snapshot = {
        ...currentSnapshot,
        players: currentSnapshot.players.map((player) =>
          player.userId === payload.userId
            ? {
                ...player,
                isReady: payload.isReady,
              }
            : player,
        ),
      }

      saveSnapshot(storage, snapshot)
      handlers.onRoomStateChanged?.(snapshot)

      if (!fromSelf) {
        publish('room-state', snapshot)
      }

      return
    }

    if (envelope.type === 'phase-changed' && isPhasePayload(envelope.payload)) {
      handlers.onPhaseChanged?.(envelope.payload)
    }
  }

  return {
    getConnectionStatus() {
      return status
    },
    async connect(_session: LoginSession, nextHandlers: RoomRealtimeHandlers) {
      handlers = nextHandlers

      try {
        channel = createChannel(channelName)
        channel.onmessage = (event: MessageEvent<RoomRealtimeEnvelope>) => {
          if (isEnvelope(event.data)) {
            handleEnvelope(event.data)
          }
        }
        status = { status: 'online' }
        handlers.onConnectionStatus?.('online')
        return { ok: true, value: undefined }
      } catch {
        const message = '로컬 실시간 연결을 사용할 수 없어요.'
        status = {
          status: 'offline',
          message,
        }
        handlers.onConnectionStatus?.('offline', message)
        return {
          ok: false,
          error: {
            kind: 'offline',
            message,
            retryable: true,
          },
        }
      }
    },
    disconnect() {
      channel?.close()
      channel = null
      handlers = {}
      status = { status: 'offline' }
    },
    joinRoom(payload) {
      publish('player-joined', {
        roomId: payload.roomId,
        userId: payload.userId,
        nickname: payload.nickname,
        isHost: payload.isHost === true,
      })
      handlers.onRoomJoined?.(loadSnapshot(storage, payload.roomId))
    },
    leaveRoom(payload) {
      publish('player-left', payload)
      status = { status: 'offline' }
    },
    setReady(payload) {
      publish('ready-changed', payload)
    },
    startRoom(payload) {
      const currentSnapshot = loadSnapshot(storage, payload.roomId)
      const snapshot: RoomRealtimeSnapshot = {
        ...currentSnapshot,
        phase: 'building',
        phaseEndsAt: new Date(Date.now() + 180_000).toISOString(),
      }

      saveSnapshot(storage, snapshot)
      publish('phase-changed', {
        roomId: payload.roomId,
        phase: 'building',
        phaseEndsAt: snapshot.phaseEndsAt,
      })
      publish('room-state', snapshot)
    },
  }
}

function loadSnapshot(storage: RoomRealtimeStorage, roomId: string): RoomRealtimeSnapshot {
  const snapshots = loadSnapshots(storage)

  return snapshots[roomId] ?? {
    roomId,
    phase: 'lobby',
    phaseEndsAt: null,
    players: [],
  }
}

function saveSnapshot(storage: RoomRealtimeStorage, snapshot: RoomRealtimeSnapshot) {
  const snapshots = loadSnapshots(storage)

  snapshots[snapshot.roomId] = snapshot
  storage.setItem(
    snapshotStorageKey,
    JSON.stringify({
      schemaVersion: 'local-room-realtime-v1',
      snapshots,
    }),
  )
}

function loadSnapshots(storage: RoomRealtimeStorage): Record<string, RoomRealtimeSnapshot> {
  const rawValue = storage.getItem(snapshotStorageKey)

  if (!rawValue) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue) as { snapshots?: unknown }
    const snapshots = parsed.snapshots

    if (!isRecord(snapshots)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(snapshots).filter((entry): entry is [string, RoomRealtimeSnapshot] =>
        isRoomRealtimeSnapshot(entry[1]),
      ),
    )
  } catch {
    return {}
  }
}

function upsertPlayer(
  snapshot: RoomRealtimeSnapshot,
  player: RoomRealtimeSnapshot['players'][number],
): RoomRealtimeSnapshot {
  const players = snapshot.players.some((candidate) => candidate.userId === player.userId)
    ? snapshot.players.map((candidate) =>
        candidate.userId === player.userId
          ? {
              ...candidate,
              nickname: player.nickname,
              isHost: candidate.isHost || player.isHost,
            }
          : candidate,
      )
    : [
        ...snapshot.players,
        {
          ...player,
          isHost: player.isHost,
          isReady: player.isReady || player.isHost,
        },
      ]

  const nextSnapshot = {
    ...snapshot,
    players,
  }

  return player.isHost || snapshot.players.length > 0 ? ensureHost(nextSnapshot) : nextSnapshot
}

function ensureHost(snapshot: RoomRealtimeSnapshot): RoomRealtimeSnapshot {
  if (snapshot.players.length === 0 || snapshot.players.some((player) => player.isHost)) {
    return snapshot
  }

  return {
    ...snapshot,
    players: snapshot.players.map((player, index) => ({
      ...player,
      isHost: index === 0,
      isReady: index === 0 ? true : player.isReady,
    })),
  }
}

function isEnvelope(value: unknown): value is RoomRealtimeEnvelope {
  return (
    isRecord(value) &&
    typeof value.senderId === 'string' &&
    (
      value.type === 'room-state' ||
      value.type === 'player-joined' ||
      value.type === 'player-left' ||
      value.type === 'ready-changed' ||
      value.type === 'phase-changed'
    )
  )
}

function isPlayerJoinedPayload(
  value: unknown,
): value is { roomId: string; userId: string; nickname: string; isHost: boolean } {
  return (
    isRecord(value) &&
    typeof value.roomId === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.nickname === 'string' &&
    typeof value.isHost === 'boolean'
  )
}

function isPlayerLeftPayload(value: unknown): value is { roomId: string; userId: string } {
  return isRecord(value) && typeof value.roomId === 'string' && typeof value.userId === 'string'
}

function isReadyChangedPayload(
  value: unknown,
): value is { roomId: string; userId: string; isReady: boolean } {
  return (
    isRecord(value) &&
    typeof value.roomId === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.isReady === 'boolean'
  )
}

function isRoomRealtimeSnapshot(value: unknown): value is RoomRealtimeSnapshot {
  if (!isRecord(value) || typeof value.roomId !== 'string' || !Array.isArray(value.players)) {
    return false
  }

  return value.players.every(
    (player) =>
      isRecord(player) &&
      typeof player.userId === 'string' &&
      typeof player.nickname === 'string' &&
      typeof player.isHost === 'boolean' &&
      typeof player.isReady === 'boolean',
  )
}

function isPhasePayload(
  value: unknown,
): value is { roomId: string; phase: RoomRealtimeSnapshot['phase']; phaseEndsAt: string | null } {
  return isRecord(value) && typeof value.roomId === 'string' && typeof value.phase === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getDefaultStorage(): RoomRealtimeStorage {
  if (typeof window !== 'undefined') {
    return window.localStorage
  }

  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}
