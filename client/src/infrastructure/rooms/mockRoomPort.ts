import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  RoomControllerError,
  RoomPort,
  RoomRealtimeSnapshot,
  RoomResult,
  RoomSummaryRecord,
} from '../../pages/room/roomControllerCore'

interface RoomStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface MockRoomPortOptions {
  storage?: RoomStorage
  nowMs?: () => number
}

interface StoredRoom extends RoomSummaryRecord {
  password?: string
  memberIds: string[]
  readyUserIds: string[]
  createdAtMs: number
}

const roomStorageKey = 'relay.mock.rooms'

export function createMockRoomPort({
  storage = getDefaultStorage(),
  nowMs = () => Date.now(),
}: MockRoomPortOptions = {}): RoomPort {
  return {
    async listRooms(_session, _dataMode) {
      const rooms = loadRooms(storage, nowMs)

      saveRooms(storage, rooms)

      return {
        ok: true,
        value: rooms.map((room) => toRoomSummary(room, nowMs())),
      }
    },
    async getRoomSnapshot(_session, roomId, _dataMode) {
      const rooms = loadRooms(storage, nowMs)
      const room = rooms.find((candidate) => candidate.id === roomId)

      return room
        ? { ok: true, value: toRoomSnapshot(room) }
        : createFailure('not_found', '방 상태를 조회할 수 없어요.', true)
    },
    async createRoom(session, payload, _dataMode) {
      const rooms = loadRooms(storage, nowMs)
      const room: StoredRoom = {
        id: `mock-room-${Math.random().toString(36).slice(2, 8)}`,
        name: payload.name,
        hostId: session.id,
        hostNickname: session.nickname,
        isPublic: payload.isPublic,
        players: 1,
        maxPlayers: payload.maxPlayers,
        phase: 'lobby',
        elapsedSeconds: 0,
        phaseEndsAt: null,
        password: payload.isPublic ? undefined : payload.password,
        memberIds: [session.id],
        readyUserIds: [session.id],
        createdAtMs: nowMs(),
      }
      const nextRooms = [room, ...rooms]

      saveRooms(storage, nextRooms)

      return {
        ok: true,
        value: toRoomSummary(room, nowMs()),
      }
    },
    async joinPublicRoom(session, _dataMode) {
      const rooms = loadRooms(storage, nowMs)
      const room = rooms.find(
        (candidate) =>
          candidate.isPublic &&
          candidate.phase === 'lobby' &&
          candidate.memberIds.length < candidate.maxPlayers,
      )

      if (!room) {
        return createFailure('not_found', '입장 가능한 공개방이 없습니다.', true)
      }

      return joinStoredRoom(storage, rooms, room, session, undefined, nowMs())
    },
    async joinRoom(session, roomId, password, _dataMode) {
      const rooms = loadRooms(storage, nowMs)
      const room = rooms.find((candidate) => candidate.id === roomId)

      if (!room || room.phase !== 'lobby') {
        return createFailure('not_found', '입장할 수 있는 방을 찾을 수 없어요.', true)
      }

      if (room.memberIds.length >= room.maxPlayers && !room.memberIds.includes(session.id)) {
        return createFailure('conflict', '정원이 찼어요.', true)
      }

      if (!room.isPublic && (password ?? '') !== (room.password ?? '')) {
        return createFailure('authorization', '비밀번호를 확인해주세요.', true)
      }

      return joinStoredRoom(storage, rooms, room, session, password, nowMs())
    },
    async startRoom(session, roomId, _dataMode) {
      const rooms = loadRooms(storage, nowMs)
      const room = rooms.find((candidate) => candidate.id === roomId)

      if (!room) {
        return createFailure('not_found', '시작할 방을 찾을 수 없어요.', true)
      }

      if (room.hostId !== session.id) {
        return createFailure('authorization', '방장만 게임을 시작할 수 있어요.', false)
      }

      if (room.memberIds.length < 2) {
        return createFailure('conflict', '최소 2명이 필요해요.', true)
      }

      if (!areGuestsReady(room)) {
        return createFailure('conflict', '아직 준비하지 않은 플레이어가 있어요.', true)
      }

      const updatedRoom: StoredRoom = {
        ...room,
        phase: 'building',
        elapsedSeconds: 0,
        phaseEndsAt: createPhaseEndsAt('building', nowMs()),
        createdAtMs: nowMs(),
      }
      const nextRooms = rooms.map((candidate) => (candidate.id === room.id ? updatedRoom : candidate))

      saveRooms(storage, nextRooms)

      return {
        ok: true,
        value: toRoomSummary(updatedRoom, nowMs()),
      }
    },
    async setReady(session, roomId, isReady, _dataMode) {
      const rooms = loadRooms(storage, nowMs)
      const room = rooms.find((candidate) => candidate.id === roomId)

      if (!room || room.phase !== 'lobby' || !room.memberIds.includes(session.id)) {
        return createFailure('not_found', '준비 상태를 바꿀 방을 찾을 수 없어요.', true)
      }

      if (room.hostId === session.id) {
        return createFailure('conflict', '방장은 항상 준비 상태예요.', false)
      }

      const readyUserIds = isReady
        ? [...new Set([...room.readyUserIds, session.id])]
        : room.readyUserIds.filter((userId) => userId !== session.id)
      const updatedRoom = {
        ...room,
        readyUserIds: normalizeReadyUserIds({ ...room, readyUserIds }, room.memberIds),
      }
      const nextRooms = rooms.map((candidate) => (candidate.id === room.id ? updatedRoom : candidate))

      saveRooms(storage, nextRooms)

      return { ok: true, value: toRoomSnapshot(updatedRoom) }
    },
    async leaveRoom(session, roomId, _dataMode) {
      const rooms = loadRooms(storage, nowMs)
      const room = rooms.find((candidate) => candidate.id === roomId)

      if (!room || !room.memberIds.includes(session.id)) {
        return createFailure('not_found', '나갈 방을 찾을 수 없어요.', true)
      }

      const memberIds = room.memberIds.filter((memberId) => memberId !== session.id)

      if (memberIds.length === 0) {
        saveRooms(storage, rooms.filter((candidate) => candidate.id !== room.id))
        return { ok: true, value: null }
      }

      const hostId = memberIds.includes(room.hostId ?? '') ? room.hostId : memberIds[0]
      const updatedRoom: StoredRoom = {
        ...room,
        hostId,
        hostNickname: hostId === room.hostId ? room.hostNickname : '방장',
        memberIds,
        readyUserIds: normalizeReadyUserIds({ ...room, hostId }, memberIds),
      }
      const nextRooms = rooms.map((candidate) => (candidate.id === room.id ? updatedRoom : candidate))

      saveRooms(storage, nextRooms)

      return { ok: true, value: toRoomSnapshot(updatedRoom) }
    },
  }
}

function joinStoredRoom(
  storage: RoomStorage,
  rooms: StoredRoom[],
  room: StoredRoom,
  session: LoginSession,
  _password: string | undefined,
  nowMs: number,
): RoomResult<RoomSummaryRecord> {
  const updatedRoom: StoredRoom = {
    ...room,
    memberIds: room.memberIds.includes(session.id)
      ? room.memberIds
      : [...room.memberIds, session.id],
    readyUserIds: normalizeReadyUserIds(room, room.memberIds.includes(session.id)
      ? room.memberIds
      : [...room.memberIds, session.id]),
  }
  const nextRooms = rooms.map((candidate) => (candidate.id === room.id ? updatedRoom : candidate))

  saveRooms(storage, nextRooms)

  return {
    ok: true,
    value: toRoomSummary(updatedRoom, nowMs),
  }
}

function loadRooms(storage: RoomStorage, nowMs: () => number): StoredRoom[] {
  const storedRooms = readStoredRooms(storage)

  if (storedRooms.length > 0) {
    return storedRooms
  }

  return createSeedRooms(nowMs())
}

function readStoredRooms(storage: RoomStorage): StoredRoom[] {
  const rawValue = storage.getItem(roomStorageKey)

  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue) as { rooms?: unknown } | unknown[]
    const candidate = Array.isArray(parsed) ? parsed : parsed.rooms

    return Array.isArray(candidate)
      ? candidate
          .filter(isStoredRoom)
          .map((room) => ({
            ...room,
            readyUserIds: normalizeReadyUserIds(
              {
                hostId: room.hostId,
                readyUserIds: room.readyUserIds ?? [],
              },
              room.memberIds,
            ),
          }))
      : []
  } catch {
    return []
  }
}

function saveRooms(storage: RoomStorage, rooms: StoredRoom[]) {
  storage.setItem(
    roomStorageKey,
    JSON.stringify({
      schemaVersion: 'mock-rooms-v1',
      rooms,
    }),
  )
}

function createSeedRooms(nowMs: number): StoredRoom[] {
  return [
    {
      id: 'mock-room-public-open',
      name: '공개 릴레이 방',
      hostId: 'mock-host-public',
      hostNickname: '노란방장',
      isPublic: true,
      players: 1,
      maxPlayers: 4,
      phase: 'lobby',
      elapsedSeconds: 0,
      phaseEndsAt: null,
      memberIds: ['mock-host-public'],
      readyUserIds: ['mock-host-public'],
      createdAtMs: nowMs,
    },
    {
      id: 'mock-room-private-open',
      name: '친구 전용 비공개방',
      hostId: 'mock-host-private',
      hostNickname: '초대장',
      isPublic: false,
      players: 1,
      maxPlayers: 3,
      phase: 'lobby',
      elapsedSeconds: 0,
      phaseEndsAt: null,
      password: '1234',
      memberIds: ['mock-host-private'],
      readyUserIds: ['mock-host-private'],
      createdAtMs: nowMs,
    },
    {
      id: 'mock-room-full',
      name: '정원 마감 방',
      hostId: 'mock-host-full',
      hostNickname: '가득이',
      isPublic: true,
      players: 4,
      maxPlayers: 4,
      phase: 'lobby',
      elapsedSeconds: 0,
      phaseEndsAt: null,
      memberIds: ['mock-host-full', 'mock-full-2', 'mock-full-3', 'mock-full-4'],
      readyUserIds: ['mock-host-full', 'mock-full-2', 'mock-full-3', 'mock-full-4'],
      createdAtMs: nowMs,
    },
    {
      id: 'mock-room-playing',
      name: '제작 진행 중인 방',
      hostId: 'mock-host-playing',
      hostNickname: '달리는방장',
      isPublic: true,
      players: 2,
      maxPlayers: 4,
      phase: 'racing',
      elapsedSeconds: 187,
      phaseEndsAt: createPhaseEndsAt('racing', nowMs - 187_000),
      memberIds: ['mock-host-playing', 'mock-playing-2'],
      readyUserIds: ['mock-host-playing', 'mock-playing-2'],
      createdAtMs: nowMs - 187_000,
    },
  ]
}

function toRoomSnapshot(room: StoredRoom): RoomRealtimeSnapshot {
  return {
    roomId: room.id,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    players: room.memberIds.map((userId, index) => ({
      userId,
      nickname: userId === room.hostId ? room.hostNickname : `플레이어 ${index + 1}`,
      isHost: userId === room.hostId,
      isReady: userId === room.hostId || room.readyUserIds.includes(userId),
    })),
  }
}

function toRoomSummary(room: StoredRoom, nowMs: number): RoomSummaryRecord {
  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    hostNickname: room.hostNickname,
    isPublic: room.isPublic,
    players: room.memberIds.length,
    maxPlayers: room.maxPlayers,
    phase: room.phase,
    elapsedSeconds:
      room.phase === 'lobby'
        ? room.elapsedSeconds
        : Math.max(room.elapsedSeconds, Math.floor((nowMs - room.createdAtMs) / 1000)),
    phaseEndsAt: createPhaseEndsAt(room.phase, room.createdAtMs),
  }
}

function normalizeReadyUserIds(room: Pick<StoredRoom, 'hostId' | 'readyUserIds'>, memberIds: string[]) {
  return [...new Set([
    ...(room.hostId ? [room.hostId] : []),
    ...room.readyUserIds.filter((userId) => memberIds.includes(userId)),
  ])]
}

function areGuestsReady(room: StoredRoom) {
  return room.memberIds
    .filter((memberId) => memberId !== room.hostId)
    .every((memberId) => room.readyUserIds.includes(memberId))
}

function createPhaseEndsAt(phase: RoomSummaryRecord['phase'], phaseStartedAtMs: number) {
  const durationMs =
    phase === 'building'
      ? 180_000
      : phase === 'validating'
        ? 90_000
        : phase === 'racing'
          ? 300_000
          : null

  return durationMs === null ? null : new Date(phaseStartedAtMs + durationMs).toISOString()
}

function createFailure(
  kind: RoomControllerError['kind'],
  message: string,
  retryable: boolean,
): RoomResult<never> {
  return {
    ok: false,
    error: {
      kind,
      message,
      retryable,
    },
  }
}

function isStoredRoom(value: unknown): value is StoredRoom {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.hostNickname === 'string' &&
    typeof value.isPublic === 'boolean' &&
    Array.isArray(value.memberIds) &&
    (Array.isArray(value.readyUserIds) || value.readyUserIds === undefined)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getDefaultStorage(): RoomStorage {
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
