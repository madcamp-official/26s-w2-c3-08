import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  CreateRoomPayload,
  RoomControllerError,
  RoomPort,
  RoomResult,
  RoomRealtimeSnapshot,
  RoomSummaryRecord,
} from '../../pages/room/roomControllerCore'
import {
  logMalformedResponse,
  type MalformedResponseReason,
} from '../diagnostics/malformedResponseLogger'

interface RemoteRoomPortOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

export function createRemoteRoomPort({
  baseUrl = '',
  fetcher = fetch,
}: RemoteRoomPortOptions = {}): RoomPort {
  return {
    async listRooms(session) {
      return requestRoomList(fetcher, `${baseUrl}/api/rooms`, session, 'rooms.list')
    },
    async getRoomSnapshot(session, roomId) {
      return requestRoomSnapshot(fetcher, `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}`, session, 'rooms.snapshot', {
        method: 'GET',
      })
    },
    async createRoom(session, payload) {
      return requestRoom(fetcher, `${baseUrl}/api/rooms`, session, 'rooms.create', {
        method: 'POST',
        body: JSON.stringify(toCreateRoomBody(session, payload)),
      })
    },
    async joinPublicRoom(session) {
      return requestRoom(fetcher, `${baseUrl}/api/rooms/public/join`, session, 'rooms.joinPublic', {
        method: 'POST',
        body: JSON.stringify({ user_id: session.id }),
      })
    },
    async joinRoom(session, roomId, password) {
      return requestRoom(fetcher, `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/join`, session, 'rooms.joinPrivate', {
        method: 'POST',
        body: JSON.stringify({
          user_id: session.id,
          password,
        }),
      })
    },
    async startRoom(session, roomId) {
      return requestRoom(fetcher, `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/start`, session, 'rooms.start', {
        method: 'POST',
        body: JSON.stringify({
          user_id: session.id,
        }),
      })
    },
    async setReady(session, roomId, isReady) {
      return requestRoomSnapshot(fetcher, `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/ready`, session, 'rooms.setReady', {
        method: 'POST',
        body: JSON.stringify({
          user_id: session.id,
          is_ready: isReady,
        }),
      })
    },
    async leaveRoom(session, roomId) {
      const responseResult = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/leave`,
        session,
        'rooms.leave',
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: session.id,
          }),
        },
      )

      if (!responseResult.ok) {
        return responseResult
      }

      const body = responseResult.value

      if (isRecord(body) && body.room === null) {
        return { ok: true, value: null }
      }

      const snapshot = normalizeRoomSnapshot(body)

      return snapshot
        ? { ok: true, value: snapshot }
        : createMalformedFailure('rooms.leave', `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/leave`, 'unexpected_shape', body)
    },
  }
}

async function requestRoomList(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
  operation: string,
): Promise<RoomResult<RoomSummaryRecord[]>> {
  const responseResult = await requestJson(fetcher, input, session, operation)

  if (!responseResult.ok) {
    return responseResult
  }

  const rooms = unwrapRooms(responseResult.value)

  if (!rooms) {
    return createMalformedFailure(operation, input, 'unexpected_shape', responseResult.value)
  }

  const normalizedRooms = rooms.map(normalizeRoomSummary)

  if (normalizedRooms.some((room) => room === null)) {
    return createMalformedFailure(operation, input, 'unexpected_shape', responseResult.value)
  }

  return {
    ok: true,
    value: normalizedRooms as RoomSummaryRecord[],
  }
}

async function requestRoom(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
  operation: string,
  init: RequestInit,
): Promise<RoomResult<RoomSummaryRecord>> {
  const responseResult = await requestJson(fetcher, input, session, operation, init)

  if (!responseResult.ok) {
    return responseResult
  }

  const room = unwrapRoom(responseResult.value)
  const normalizedRoom = room ? normalizeRoomSummary(room) : null

  if (!normalizedRoom) {
    return createMalformedFailure(operation, input, 'unexpected_shape', responseResult.value)
  }

  return {
    ok: true,
    value: normalizedRoom,
  }
}

async function requestRoomSnapshot(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
  operation: string,
  init: RequestInit,
): Promise<RoomResult<RoomRealtimeSnapshot>> {
  const responseResult = await requestJson(fetcher, input, session, operation, init)

  if (!responseResult.ok) {
    return responseResult
  }

  const snapshot = normalizeRoomSnapshot(responseResult.value)

  return snapshot
    ? { ok: true, value: snapshot }
    : createMalformedFailure(operation, input, 'unexpected_shape', responseResult.value)
}

async function requestJson(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
  operation: string,
  init: RequestInit = {},
): Promise<RoomResult<unknown>> {
  let response: Response

  try {
    response = await fetcher(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        ...init.headers,
      },
    })
  } catch {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', true)
  }

  let body: unknown

  try {
    body = await response.json()
  } catch {
    return createMalformedFailure(operation, input, 'invalid_json', undefined, response.status)
  }

  if (!response.ok) {
    return mapHttpError(response.status, body)
  }

  return {
    ok: true,
    value: body,
  }
}

function createMalformedFailure<T>(
  operation: string,
  input: RequestInfo | URL,
  reason: MalformedResponseReason,
  body?: unknown,
  status?: number,
): RoomResult<T> {
  logMalformedResponse({
    source: 'api',
    adapter: 'remoteRoomPort',
    operation,
    reason,
    endpoint: input,
    status,
    body,
  })

  return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
}

function toCreateRoomBody(session: LoginSession, payload: CreateRoomPayload) {
  return {
    user_id: session.id,
    name: payload.name,
    is_public: payload.isPublic,
    password: payload.password,
    max_players: payload.maxPlayers,
  }
}

function unwrapRooms(body: unknown): Array<Record<string, unknown>> | null {
  if (!isRecord(body)) {
    return null
  }

  const candidate = Array.isArray(body.rooms) ? body.rooms : Array.isArray(body.data) ? body.data : null

  return candidate ? candidate.filter(isRecord) : null
}

function unwrapRoom(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) {
    return null
  }

  const candidate = isRecord(body.room) ? body.room : isRecord(body.data) ? body.data : body

  return isRecord(candidate) ? candidate : null
}

function normalizeRoomSnapshot(body: unknown): RoomRealtimeSnapshot | null {
  if (!isRecord(body) || !Array.isArray(body.players)) {
    return null
  }

  const room = unwrapRoom(body)
  const summary = room ? normalizeRoomSummary(room) : null

  if (!summary) {
    return null
  }

  const players = body.players
    .filter(isRecord)
    .map((player) => ({
      userId: readString(player.userId) ?? readString(player.user_id) ?? '',
      nickname: readString(player.nickname) ?? '플레이어',
      isHost: readBoolean(player.isHost) ?? readBoolean(player.is_host) ?? false,
      isReady: readBoolean(player.isReady) ?? readBoolean(player.is_ready) ?? false,
    }))
    .filter((player) => player.userId.length > 0)

  if (players.length !== body.players.filter(isRecord).length) {
    return null
  }

  return {
    roomId: summary.id,
    phase: summary.phase,
    phaseEndsAt: summary.phaseEndsAt,
    players,
  }
}

function normalizeRoomSummary(room: Record<string, unknown>): RoomSummaryRecord | null {
  const id = readString(room.id)
  const name = readString(room.name)
  const hostNickname = readString(room.hostNickname) ?? readString(room.host_nickname)
  const phase = normalizePhase(readString(room.phase))
  const maxPlayers = normalizeMaxPlayers(readNumber(room.maxPlayers) ?? readNumber(room.max_players))
  const players = readNumber(room.players)

  if (!id || !name || !hostNickname || !phase || !maxPlayers || players === null) {
    return null
  }

  return {
    id,
    name,
    hostId: readString(room.hostId) ?? readString(room.host_id) ?? null,
    hostNickname,
    isPublic: readBoolean(room.isPublic) ?? readBoolean(room.is_public) ?? true,
    players,
    maxPlayers,
    phase,
    elapsedSeconds: readNumber(room.elapsedSeconds) ?? readNumber(room.elapsed_seconds) ?? 0,
    phaseEndsAt: readString(room.phaseEndsAt) ?? readString(room.phase_ends_at) ?? null,
  }
}

function mapHttpError(status: number, body: unknown): RoomResult<never> {
  const message = readBackendErrorMessage(body)

  if (status === 401) {
    return createFailure('authentication', message ?? '로그인이 필요해요.', true)
  }

  if (status === 403) {
    return createFailure('authorization', '비밀번호를 확인해주세요.', true)
  }

  if (status === 404) {
    return createFailure('not_found', message ?? '입장 가능한 방이 없습니다.', true)
  }

  if (status === 409) {
    return createFailure('conflict', message ?? '정원이 찼어요.', true)
  }

  if (status >= 500) {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', true)
  }

  return createFailure('validation', message ?? '요청 내용을 확인해주세요.', false)
}

function readBackendErrorMessage(body: unknown) {
  if (!isRecord(body) || !isRecord(body.error)) {
    return undefined
  }

  return readString(body.error.message)
}

function normalizePhase(value: string | undefined): RoomSummaryRecord['phase'] | null {
  if (
    value === 'lobby' ||
    value === 'building' ||
    value === 'validating' ||
    value === 'merging' ||
    value === 'racing' ||
    value === 'finished'
  ) {
    return value
  }

  return null
}

function normalizeMaxPlayers(value: number | null): 2 | 3 | 4 | null {
  if (value === 2 || value === 3 || value === 4) {
    return value
  }

  return null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
