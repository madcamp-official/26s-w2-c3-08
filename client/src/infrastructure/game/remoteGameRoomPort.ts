import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  GameControllerError,
  GameResult,
  GameRoomSnapshot,
  GameRoomPort,
  FinishGameRacePayload,
  SaveGameRaceProgressPayload,
  SaveGameMapSegmentPayload,
} from '../../pages/game/gameControllerCore'
import type {
  Asset,
  AssetCategory,
  MapPlacement,
  MapSegmentAssetSnapshot,
  MapSegmentSnapshot,
  MergedMap,
  MergedMapPlacement,
  RoomPhase,
} from '../../types/domain'
import type { RaceResult } from 'shared/schemas'

interface RemoteGameRoomPortOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

export function createRemoteGameRoomPort({
  baseUrl = '',
  fetcher = fetch,
}: RemoteGameRoomPortOptions = {}): GameRoomPort {
  return {
    async getRoomSnapshot(session, roomId) {
      const response = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}`,
        session,
        { method: 'GET' },
      )

      if (!response.ok) {
        return response
      }

      const snapshot = normalizeRoomSnapshot(response.value)

      return snapshot
        ? { ok: true, value: snapshot }
        : createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
    },
    async saveMapSegment(session, payload) {
      const response = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(payload.roomId)}/segments`,
        session,
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: session.id,
            start_point: payload.startPoint,
            end_point: payload.endPoint,
            assets: payload.placements.map(toSegmentAssetRef),
          }),
        },
      )

      if (!response.ok) {
        return response
      }

      const segment = normalizeSegment(response.value, payload)

      return segment
        ? { ok: true, value: { ...segment, roomPhase: normalizeRoomPhase(response.value) } }
        : createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
    },
    async getMapSegment(session, roomId, segmentId) {
      const response = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/segments/${encodeURIComponent(segmentId)}`,
        session,
        { method: 'GET' },
      )

      if (!response.ok) {
        return response
      }

      const segment = normalizeSegment(response.value, {
        roomId,
        creatorId: session.id,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 0, y: 0 },
        placements: [],
      })

      return segment
        ? { ok: true, value: { ...segment, roomPhase: normalizeRoomPhase(response.value) } }
        : createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
    },
    async validateMapSegment(session, payload) {
      const response = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(payload.roomId)}/segments/validate`,
        session,
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: session.id,
            segment_hash: payload.segmentHash,
            cleared: payload.cleared,
            clear_time_ms: payload.clearTimeMs,
          }),
        },
      )

      if (!response.ok) {
        return response
      }

      const segment = normalizeSegment(response.value, {
        roomId: payload.roomId,
        creatorId: payload.userId,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 0, y: 0 },
        placements: [],
      })

      return segment
        ? { ok: true, value: { ...segment, roomPhase: normalizeRoomPhase(response.value) } }
        : createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
    },
    async mergeRoomMap(session, roomId) {
      const response = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/merge`,
        session,
        { method: 'POST', body: JSON.stringify({ user_id: session.id }) },
      )

      if (!response.ok) {
        return response
      }

      const mergedMap = normalizeMergedMap(response.value, roomId)

      return mergedMap
        ? { ok: true, value: mergedMap }
        : createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
    },
    async getMergedMap(session, roomId, mergedMapId) {
      const query = mergedMapId
        ? `?merged_map_id=${encodeURIComponent(mergedMapId)}`
        : ''
      const response = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/merged-map${query}`,
        session,
        { method: 'GET' },
      )

      if (!response.ok) {
        return response
      }

      const mergedMap = normalizeMergedMap(response.value, roomId)

      return mergedMap
        ? { ok: true, value: mergedMap }
        : createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
    },
    async saveRaceProgress(session, payload) {
      const response = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(payload.roomId)}/race/progress`,
        session,
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: payload.userId,
            progress: payload.progress,
            race_distance_to_goal: payload.raceDistanceToGoal,
          }),
        },
      )

      if (!response.ok) {
        return response
      }

      const result = normalizeRaceResult(response.value, payload)

      return result
        ? { ok: true, value: result }
        : createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
    },
    async finishRace(session, payload) {
      const response = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(payload.roomId)}/race/finish`,
        session,
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: payload.userId,
            finish_time_ms: payload.finishTimeMs,
          }),
        },
      )

      if (!response.ok) {
        return response
      }

      const result = normalizeRaceResult(response.value, payload)

      return result
        ? { ok: true, value: result }
        : createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
    },
    async getRaceResults(session, roomId) {
      const response = await requestJson(
        fetcher,
        `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/results`,
        session,
        { method: 'GET' },
      )

      if (!response.ok) {
        return response
      }

      const result = normalizeRaceResult(response.value, { roomId, userId: session.id, finishTimeMs: 0 })

      return result
        ? { ok: true, value: result }
        : createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
    },
  }
}

async function requestJson(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
  init: RequestInit,
): Promise<GameResult<unknown>> {
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
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
  }

  if (!response.ok) {
    return mapHttpError(response.status, body)
  }

  return { ok: true, value: body }
}

function normalizeSegment(
  body: unknown,
  fallback: SaveGameMapSegmentPayload,
): MapSegmentSnapshot | null {
  const record = unwrapRecord(body, 'segment')

  if (!record) {
    return null
  }

  const id = readString(record.id) ?? readString(record.segment_id) ?? `remote-segment-${fallback.roomId}`
  const segmentHash = readString(record.segmentHash) ?? readString(record.segment_hash) ?? id
  const submittedAt =
    readString(record.submittedAt) ?? readString(record.submitted_at) ?? new Date(0).toISOString()
  const validatedAt = readString(record.validatedAt) ?? readString(record.validated_at) ?? null
  const placements = Array.isArray(record.placements)
    ? record.placements.filter(isRecord).map((placement) => normalizePlacement(placement)).filter(isPlacement)
    : fallback.placements
  const assetRefs: MapSegmentAssetSnapshot[] = Array.isArray(record.assets)
    ? record.assets.filter(isRecord).map(normalizeAssetRef)
    : placements.map(toSegmentAssetRef)

  return {
    id,
    roomId: readString(record.roomId) ?? readString(record.room_id) ?? fallback.roomId,
    creatorId: readString(record.creatorId) ?? readString(record.creator_id) ?? fallback.creatorId,
    startPoint: readPoint(record.startPoint) ?? readPoint(record.start_point) ?? fallback.startPoint,
    endPoint: readPoint(record.endPoint) ?? readPoint(record.end_point) ?? fallback.endPoint,
    placements,
    assetRefs,
    segmentHash,
    isValidated: readBoolean(record.isValidated) ?? readBoolean(record.is_validated) ?? false,
    submittedAt,
    validatedAt,
    clearTimeMs: readNumber(record.clearTimeMs) ?? readNumber(record.clear_time_ms),
  }
}

function normalizeMergedMap(body: unknown, roomId: string): MergedMap | null {
  const record = unwrapRecord(body, 'mergedMap') ?? unwrapRecord(body, 'map')

  if (!record) {
    return null
  }

  const segments = Array.isArray(record.segments)
    ? record.segments
        .filter(isRecord)
        .map((segment) =>
          normalizeSegment(segment, {
            roomId,
            creatorId: readString(segment.creatorId) ?? readString(segment.creator_id) ?? 'remote',
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 0, y: 0 },
            placements: [],
          }),
        )
        .filter((segment): segment is MapSegmentSnapshot => segment !== null)
    : []
  const placements: MergedMapPlacement[] = Array.isArray(record.placements)
    ? record.placements.filter(isRecord).map((placement) => ({
        ...normalizeAssetRef(placement),
        sourceSegmentId:
          readString(placement.sourceSegmentId) ??
          readString(placement.source_segment_id) ??
          segments[0]?.id ??
          'remote-segment',
      }))
    : []

  return {
    id: readString(record.id) ?? readString(record.map_id) ?? `remote-merged-${roomId}`,
    roomId: readString(record.roomId) ?? readString(record.room_id) ?? roomId,
    globalStart: readPoint(record.globalStart) ?? readPoint(record.global_start) ?? { x: 0, y: 0 },
    globalEnd: readPoint(record.globalEnd) ?? readPoint(record.global_end) ?? { x: 0, y: 0 },
    placements,
    segments,
    usedFallback: readBoolean(record.usedFallback) ?? readBoolean(record.used_fallback) ?? false,
    createdAt: readString(record.createdAt) ?? readString(record.created_at) ?? new Date(0).toISOString(),
  }
}

function normalizeRoomPhase(body: unknown): RoomPhase | undefined {
  const record = unwrapRecord(body, 'room')
  const phase = readString(record?.phase)

  return isRoomPhase(phase) ? phase : undefined
}

function normalizeRaceResult(
  body: unknown,
  fallback: FinishGameRacePayload | SaveGameRaceProgressPayload,
): RaceResult & { roomPhase?: RoomPhase } | null {
  const record = unwrapRecord(body, 'result') ?? unwrapRecord(body, 'results')

  if (!record || !Array.isArray(record.players)) {
    return null
  }

  return {
    roomId: readString(record.roomId) ?? readString(record.room_id) ?? fallback.roomId,
    roomPhase: normalizeRoomPhase(body),
    players: record.players
      .filter(isRecord)
      .map((player, index) => ({
        userId: readString(player.userId) ?? readString(player.user_id) ?? fallback.userId,
        nickname: readString(player.nickname) ?? '플레이어',
        isHost: readBoolean(player.isHost) ?? readBoolean(player.is_host) ?? false,
        isReady: readBoolean(player.isReady) ?? readBoolean(player.is_ready) ?? true,
        validationCleared:
          readBoolean(player.validationCleared) ?? readBoolean(player.validation_cleared) ?? false,
        raceProgress:
          readNumber(player.raceProgress) ?? readNumber(player.race_progress) ?? 0,
        raceFinishedAtMs:
          readNumber(player.raceFinishedAtMs) ?? readNumber(player.race_finished_at_ms),
        raceDistanceToGoal:
          readNumber(player.raceDistanceToGoal) ?? readNumber(player.race_distance_to_goal) ?? 0,
        rank: readNumber(player.rank) ?? index + 1,
      })),
  }
}

function normalizeRoomSnapshot(body: unknown): GameRoomSnapshot | null {
  if (!isRecord(body) || !Array.isArray(body.players)) {
    return null
  }

  const room = unwrapRecord(body, 'room')
  const roomId = readString(room?.id)
  const phase = normalizeRoomPhase(body)

  if (!roomId || !phase) {
    return null
  }

  const players = body.players
    .filter(isRecord)
    .map((player) => {
      const rank = readNumber(player.rank)

      return {
        userId: readString(player.userId) ?? readString(player.user_id) ?? '',
        nickname: readString(player.nickname) ?? '플레이어',
        isHost: readBoolean(player.isHost) ?? readBoolean(player.is_host) ?? false,
        isReady: readBoolean(player.isReady) ?? readBoolean(player.is_ready) ?? false,
        validationCleared:
          readBoolean(player.validationCleared) ?? readBoolean(player.validation_cleared),
        raceProgress:
          readNumber(player.raceProgress) ?? readNumber(player.race_progress) ?? undefined,
        raceFinishedAtMs:
          readNumber(player.raceFinishedAtMs) ?? readNumber(player.race_finished_at_ms),
        raceDistanceToGoal:
          readNumber(player.raceDistanceToGoal) ?? readNumber(player.race_distance_to_goal) ?? undefined,
        ...(rank === null ? {} : { rank }),
      }
    })
    .filter((player) => player.userId.length > 0)

  if (players.length !== body.players.filter(isRecord).length) {
    return null
  }

  return {
    roomId,
    phase,
    phaseEndsAt: readString(room?.phaseEndsAt) ?? readString(room?.phase_ends_at) ?? null,
    players,
  }
}

function toSegmentAssetRef(placement: MapPlacement) {
  return {
    assetId: placement.asset.id,
    assetCategory: placement.asset.category,
    assetAttrs: placement.asset.attrs,
    colliderType: placement.asset.colliderType,
    x: placement.x,
    y: placement.y,
    widthCells: Math.max(1, placement.asset.widthCells ?? 1),
    heightCells: Math.max(1, placement.asset.heightCells ?? 1),
    rotation: 0,
  }
}

function normalizeAssetRef(record: Record<string, unknown>) {
  return {
    assetId: readString(record.assetId) ?? readString(record.asset_id) ?? 'remote-asset',
    assetCategory: readAssetCategory(record.assetCategory) ?? readAssetCategory(record.asset_category),
    assetAttrs: readAttrs(record.assetAttrs) ?? readAttrs(record.asset_attrs) ?? {},
    colliderType: readCollider(record.colliderType) ?? readCollider(record.collider_type),
    x: readNumber(record.x) ?? 0,
    y: readNumber(record.y) ?? 0,
    widthCells: readNumber(record.widthCells) ?? readNumber(record.width_cells) ?? 1,
    heightCells: readNumber(record.heightCells) ?? readNumber(record.height_cells) ?? 1,
    rotation: readNumber(record.rotation) ?? 0,
  }
}

function normalizePlacement(record: Record<string, unknown>) {
  const assetRecord = isRecord(record.asset) ? record.asset : null
  const assetId = readString(assetRecord?.id) ?? readString(record.assetId) ?? readString(record.asset_id)

  if (!assetId) {
    return null
  }

  return {
    id: readString(record.id) ?? `remote-placement-${assetId}`,
    x: readNumber(record.x) ?? 0,
    y: readNumber(record.y) ?? 0,
    asset: normalizeAsset(assetRecord ?? { id: assetId }),
  }
}

function normalizeAsset(record: Record<string, unknown>): Asset {
  const id = readString(record.id) ?? 'remote-asset'
  const category = readString(record.category)

  return {
    id,
    creatorId: readString(record.creatorId) ?? readString(record.creator_id) ?? null,
    isSystem: readBoolean(record.isSystem) ?? readBoolean(record.is_system) ?? false,
    category:
      category === 'platform' ||
      category === 'obstacle' ||
      category === 'monster' ||
      category === 'background' ||
      category === 'avatar' ||
      category === 'item'
        ? category
        : 'platform',
    name: readString(record.name) ?? id,
    description: readString(record.description) ?? '',
    attrs: readAttrs(record.attrs) ?? {},
    colliderType: readCollider(record.colliderType) ?? readCollider(record.collider_type) ?? 'rect',
    widthCells: readNumber(record.widthCells) ?? readNumber(record.width_cells) ?? 1,
    heightCells: readNumber(record.heightCells) ?? readNumber(record.height_cells) ?? 1,
    sourceImageUrl: readString(record.sourceImageUrl) ?? readString(record.source_image_url) ?? '',
    remixOfId: readString(record.remixOfId) ?? readString(record.remix_of_id) ?? null,
    status: 'ready',
    isPublic: readBoolean(record.isPublic) ?? readBoolean(record.is_public) ?? false,
    createdAt: readString(record.createdAt) ?? readString(record.created_at) ?? new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: null, lastRegenAt: null }],
  }
}

function unwrapRecord(body: unknown, key: string) {
  if (!isRecord(body)) {
    return null
  }

  if (isRecord(body[key])) {
    return body[key]
  }

  if (isRecord(body.data)) {
    return body.data
  }

  return body
}

function isRoomPhase(value: unknown): value is RoomPhase {
  return (
    value === 'lobby' ||
    value === 'building' ||
    value === 'validating' ||
    value === 'merging' ||
    value === 'racing' ||
    value === 'finished'
  )
}

function mapHttpError(status: number, body: unknown): GameResult<never> {
  const message = readBackendErrorMessage(body)

  if (status === 401) {
    return createFailure('authentication', message ?? '로그인이 필요해요.', true)
  }

  if (status === 404) {
    return createFailure('not_found', message ?? '대상 방이나 맵 조각을 찾을 수 없어요.', true)
  }

  if (status === 409) {
    return createFailure('conflict', message ?? '현재 단계에서 처리할 수 없어요.', true)
  }

  if (status >= 500) {
    return createFailure('server_unavailable', message ?? '서버에 연결할 수 없어요.', true)
  }

  return createFailure('validation', message ?? '요청 내용을 확인해주세요.', false)
}

function createFailure(
  kind: GameControllerError['kind'],
  message: string,
  retryable: boolean,
): GameResult<never> {
  return {
    ok: false,
    error: {
      kind,
      message,
      retryable,
    },
  }
}

function readBackendErrorMessage(body: unknown) {
  if (!isRecord(body) || !isRecord(body.error)) {
    return undefined
  }

  return readString(body.error.message)
}

function readPoint(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const x = readNumber(value.x)
  const y = readNumber(value.y)

  return x === null || y === null ? null : { x, y }
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

function readCollider(value: unknown): Asset['colliderType'] | undefined {
  if (value === 'rect' || value === 'slope' || value === 'none') {
    return value
  }

  return undefined
}

function readAssetCategory(value: unknown): AssetCategory | undefined {
  if (
    value === 'avatar' ||
    value === 'platform' ||
    value === 'obstacle' ||
    value === 'monster' ||
    value === 'background' ||
    value === 'item'
  ) {
    return value
  }

  return undefined
}

function readAttrs(value: unknown): Record<string, string | number | boolean | null> | null {
  if (!isRecord(value)) {
    return null
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number | boolean | null] => {
      const entryValue = entry[1]

      return (
        typeof entryValue === 'string' ||
        typeof entryValue === 'number' ||
        typeof entryValue === 'boolean' ||
        entryValue === null
      )
    }),
  )
}

function isPlacement(value: unknown): value is MapPlacement {
  return isRecord(value) && isRecord(value.asset) && typeof value.id === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
