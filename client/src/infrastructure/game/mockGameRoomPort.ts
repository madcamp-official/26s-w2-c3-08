import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  GameControllerError,
  GameResult,
  GameRoomSnapshot,
  GameRoomPort,
  SaveGameMapSegmentPayload,
  SaveGameMapSegmentValue,
  ValidateGameMapSegmentValue,
} from '../../pages/game/gameControllerCore'
import type { MapSegmentSnapshot, MergedMap, RoomPhase } from '../../types/domain'
import type { RaceResult } from 'shared/schemas'
import { mapSegment, mergedMap } from '../../fixtures/game/gameFixtures'

interface GameRoomStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface MockGameRoomPortOptions {
  storage?: GameRoomStorage
  nowMs?: () => number
}

interface StoredGameRoomState {
  schemaVersion: 'mock-game-room-v1'
  segments: Record<string, MapSegmentSnapshot>
  mergedMaps: Record<string, MergedMap>
  raceResults: Record<string, RaceResult>
}

const storageKey = 'relay.mock.game-room'

export function createMockGameRoomPort({
  storage = getDefaultStorage(),
  nowMs = () => Date.now(),
}: MockGameRoomPortOptions = {}): GameRoomPort {
  return {
    async getRoomSnapshot(session, roomId) {
      const state = loadState(storage)

      return {
        ok: true,
        value: createRoomSnapshot(session, state, roomId, nowMs()),
      }
    },
    async saveMapSegment(session, payload) {
      const state = loadState(storage)
      const segment = createSegment(session, payload, nowMs())

      saveState(storage, {
        ...state,
        segments: {
          ...state.segments,
          [segment.id]: segment,
        },
      })

      return {
        ok: true,
        value: {
          ...segment,
          roomPhase: 'validating',
        } satisfies SaveGameMapSegmentValue,
      }
    },
    async getMapSegment(_session, roomId, segmentId) {
      const state = loadState(storage)
      const segment = state.segments[segmentId]

      return segment && segment.roomId === roomId
        ? { ok: true, value: segment }
        : createFailure('not_found', '검증할 맵 스냅샷이 없습니다.', true)
    },
    async validateMapSegment(session, payload) {
      const state = loadState(storage)
      const segment = Object.values(state.segments).find(
        (candidate) =>
          candidate.roomId === payload.roomId &&
          candidate.creatorId === session.id &&
          candidate.segmentHash === payload.segmentHash,
      )

      if (!segment) {
        return createFailure('not_found', '검증할 맵 스냅샷이 없습니다.', true)
      }

      const validatedSegment: ValidateGameMapSegmentValue = {
        ...segment,
        isValidated: payload.cleared,
        validatedAt: new Date(nowMs()).toISOString(),
        clearTimeMs: payload.cleared ? payload.clearTimeMs : null,
      }
      const nextSegments = {
        ...state.segments,
        [validatedSegment.id]: validatedSegment,
      }

      saveState(storage, {
        ...state,
        segments: nextSegments,
      })

      return {
        ok: true,
        value: {
          ...validatedSegment,
          roomPhase: areLatestRoomSegmentsRecorded(Object.values(nextSegments), payload.roomId)
            ? 'merging'
            : 'validating',
        },
      }
    },
    async mergeRoomMap(_session: LoginSession, roomId: string) {
      const state = loadState(storage)
      const validSegments = Object.values(state.segments).filter(
        (segment) => segment.roomId === roomId && segment.isValidated,
      )
      const fallbackSegment = Object.values(state.segments).find((segment) => segment.roomId === roomId)
      const sourceSegments = validSegments.length > 0 ? validSegments : fallbackSegment ? [fallbackSegment] : []

      if (sourceSegments.length === 0) {
        return createFailure('not_found', '병합할 맵 조각이 없습니다.', true)
      }

      const nextMergedMap: MergedMap = {
        id: `mock-merged-${roomId}-${nowMs()}`,
        roomId,
        globalStart: sourceSegments[0].startPoint,
        globalEnd: {
          x: sourceSegments.reduce((maxX, segment) => Math.max(maxX, segment.endPoint.x), 0),
          y: sourceSegments[sourceSegments.length - 1].endPoint.y,
        },
        placements: sourceSegments.flatMap((segment, segmentIndex) =>
          segment.assetRefs.map((assetRef) => ({
            ...assetRef,
            sourceSegmentId: segment.id,
            x: assetRef.x + segmentIndex * 24,
          })),
        ),
        segments: sourceSegments,
        usedFallback: validSegments.length === 0,
        createdAt: new Date(nowMs()).toISOString(),
      }

      saveState(storage, {
        ...state,
        mergedMaps: {
          ...state.mergedMaps,
          [nextMergedMap.id]: nextMergedMap,
        },
      })

      return { ok: true, value: nextMergedMap }
    },
    async getMergedMap(_session, roomId, mergedMapId) {
      const state = loadState(storage)
      const mergedMapRecord = mergedMapId
        ? state.mergedMaps[mergedMapId]
        : Object.values(state.mergedMaps)
            .filter((candidate) => candidate.roomId === roomId)
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]

      return mergedMapRecord && mergedMapRecord.roomId === roomId
        ? { ok: true, value: mergedMapRecord }
        : createFailure('not_found', '레이스 맵을 찾을 수 없어요.', true)
    },
    async saveRaceProgress(session, payload) {
      const state = loadState(storage)
      const result = createRaceResult({
        roomId: payload.roomId,
        userId: payload.userId,
        nickname: session.nickname,
        progress: payload.progress,
        raceDistanceToGoal: payload.raceDistanceToGoal,
        sourceResult: state.raceResults[payload.roomId],
        segments: Object.values(state.segments).filter((segment) => segment.roomId === payload.roomId),
      })
      const roomPhase = isRaceComplete(result) ? 'finished' : 'racing'

      saveState(storage, {
        ...state,
        raceResults: {
          ...state.raceResults,
          [payload.roomId]: result,
        },
      })

      return { ok: true, value: { ...result, roomPhase } }
    },
    async finishRace(session, payload) {
      const state = loadState(storage)
      const result = createRaceResult({
        roomId: payload.roomId,
        userId: payload.userId,
        nickname: session.nickname,
        progress: 100,
        raceDistanceToGoal: 0,
        finishTimeMs: payload.finishTimeMs,
        sourceResult: state.raceResults[payload.roomId],
        segments: Object.values(state.segments).filter((segment) => segment.roomId === payload.roomId),
      })

      saveState(storage, {
        ...state,
        raceResults: {
          ...state.raceResults,
          [payload.roomId]: result,
        },
      })

      return {
        ok: true,
        value: {
          ...result,
          roomPhase: isRaceComplete(result) ? 'finished' : 'racing',
        },
      }
    },
    async getRaceResults(_session, roomId) {
      const state = loadState(storage)
      const result = state.raceResults[roomId]

      return result
        ? { ok: true, value: result }
        : createFailure('not_found', '아직 레이스 결과가 없어요.', true)
    },
  }
}

function createRoomSnapshot(
  session: LoginSession,
  state: StoredGameRoomState,
  roomId: string,
  nowMs: number,
): GameRoomSnapshot {
  const phase = inferMockRoomPhase(state, roomId)

  return {
    roomId,
    phase,
    phaseEndsAt: createPhaseEndsAt(phase, nowMs),
    players: createRoomSnapshotPlayers(session, state, roomId, phase),
  }
}

function inferMockRoomPhase(state: StoredGameRoomState, roomId: string): RoomPhase {
  const result = state.raceResults[roomId]

  if (result && isRaceComplete(result)) {
    return 'finished'
  }

  if (result || Object.values(state.mergedMaps).some((map) => map.roomId === roomId)) {
    return 'racing'
  }

  const roomSegments = Object.values(state.segments).filter((segment) => segment.roomId === roomId)

  if (areLatestRoomSegmentsRecorded(roomSegments, roomId)) {
    return 'merging'
  }

  if (roomSegments.length > 0) {
    return 'validating'
  }

  return 'building'
}

function createRoomSnapshotPlayers(
  session: LoginSession,
  state: StoredGameRoomState,
  roomId: string,
  phase: RoomPhase,
): GameRoomSnapshot['players'] {
  const result = state.raceResults[roomId]
  const latestSegments = getLatestRoomSegments(state, roomId)
  const previousPlayers = new Map(result?.players.map((player) => [player.userId, player]) ?? [])
  const knownUserIds = new Set([
    session.id,
    ...latestSegments.keys(),
    ...previousPlayers.keys(),
  ])

  return [...knownUserIds].map((userId) => {
    const previousPlayer = previousPlayers.get(userId)
    const segment = latestSegments.get(userId)
    const raceFinishedAtMs = previousPlayer?.raceFinishedAtMs ?? null
    const validationCleared = segment?.isValidated ?? previousPlayer?.validationCleared ?? false

    return {
      userId,
      nickname: previousPlayer?.nickname ?? (userId === session.id ? session.nickname : '플레이어'),
      isHost: previousPlayer?.isHost ?? userId === session.id,
      isReady:
        phase === 'building'
          ? false
          : phase === 'validating'
            ? Boolean(segment)
            : phase === 'merging'
              ? validationCleared
              : raceFinishedAtMs !== null,
      validationCleared,
      raceProgress: previousPlayer?.raceProgress ?? 0,
      raceFinishedAtMs,
      raceDistanceToGoal: previousPlayer?.raceDistanceToGoal ?? 100,
    }
  })
}

function getLatestRoomSegments(state: StoredGameRoomState, roomId: string) {
  const latestSegments = new Map<string, MapSegmentSnapshot>()

  for (const segment of Object.values(state.segments)) {
    if (segment.roomId !== roomId) {
      continue
    }

    const previousSegment = latestSegments.get(segment.creatorId)

    if (
      !previousSegment ||
      Date.parse(segment.submittedAt) >= Date.parse(previousSegment.submittedAt)
    ) {
      latestSegments.set(segment.creatorId, segment)
    }
  }

  return latestSegments
}

function createPhaseEndsAt(phase: RoomPhase, nowMs: number) {
  const durationMs: Partial<Record<RoomPhase, number>> = {
    building: 180_000,
    validating: 90_000,
    racing: 300_000,
  }
  const duration = durationMs[phase]

  return duration ? new Date(nowMs + duration).toISOString() : null
}

function isRaceComplete(result: RaceResult) {
  return result.players.length > 0 &&
    result.players.every((player) => player.raceFinishedAtMs !== null)
}

function createRaceResult({
  roomId,
  userId,
  nickname,
  progress,
  raceDistanceToGoal,
  finishTimeMs,
  sourceResult,
  segments,
}: {
  roomId: string
  userId: string
  nickname: string
  progress: number
  raceDistanceToGoal: number
  finishTimeMs?: number
  sourceResult?: RaceResult
  segments: MapSegmentSnapshot[]
}): RaceResult {
  const previousPlayers = new Map(sourceResult?.players.map((player) => [player.userId, player]) ?? [])
  const knownUserIds = new Set([
    userId,
    ...segments.map((segment) => segment.creatorId),
    ...previousPlayers.keys(),
  ])
  const players = [...knownUserIds].map((candidateUserId) => {
    const previousPlayer = previousPlayers.get(candidateUserId)
    const segment = segments.find((candidate) => candidate.creatorId === candidateUserId)
    const isFinisher = candidateUserId === userId
    const raceFinishedAtMs = isFinisher
      ? finishTimeMs ?? previousPlayer?.raceFinishedAtMs ?? null
      : previousPlayer?.raceFinishedAtMs ?? null
    const nextRaceProgress = isFinisher
      ? Math.max(previousPlayer?.raceProgress ?? 0, progress)
      : previousPlayer?.raceProgress ?? 0
    const nextDistanceToGoal = isFinisher
      ? raceDistanceToGoal
      : previousPlayer?.raceDistanceToGoal ?? 100
    const finalProgress = raceFinishedAtMs === null ? nextRaceProgress : 100
    const finalDistanceToGoal = raceFinishedAtMs === null ? nextDistanceToGoal : 0

    return {
      userId: candidateUserId,
      nickname: previousPlayer?.nickname ?? (isFinisher ? nickname : '플레이어'),
      isHost: previousPlayer?.isHost ?? candidateUserId === userId,
      isReady: previousPlayer?.isReady ?? true,
      validationCleared: segment?.isValidated ?? previousPlayer?.validationCleared ?? false,
      raceProgress: finalProgress,
      raceFinishedAtMs,
      raceDistanceToGoal: finalDistanceToGoal,
      rank: 0,
    }
  })
  const ranks = new Map(
    [...players]
      .sort((left, right) => {
        if (left.raceFinishedAtMs !== null && right.raceFinishedAtMs !== null) {
          return left.raceFinishedAtMs - right.raceFinishedAtMs
        }

        if ((left.raceFinishedAtMs !== null) !== (right.raceFinishedAtMs !== null)) {
          return left.raceFinishedAtMs !== null ? -1 : 1
        }

        if (left.raceProgress !== right.raceProgress) {
          return right.raceProgress - left.raceProgress
        }

        return left.raceDistanceToGoal - right.raceDistanceToGoal
      })
      .map((player, index) => [player.userId, index + 1]),
  )

  return {
    roomId,
    players: players.map((player) => ({
      ...player,
      rank: ranks.get(player.userId) ?? players.length,
    })),
  }
}

function createSegment(
  session: LoginSession,
  payload: SaveGameMapSegmentPayload,
  nowMs: number,
): MapSegmentSnapshot {
  const submittedAt = new Date(nowMs).toISOString()
  const assetRefs = payload.placements.map((placement) => ({
    assetId: placement.asset.id,
    assetCategory: placement.asset.category,
    assetAttrs: placement.asset.attrs,
    colliderType: placement.asset.colliderType,
    x: placement.x,
    y: placement.y,
    widthCells: Math.max(1, placement.asset.widthCells ?? 1),
    heightCells: Math.max(1, placement.asset.heightCells ?? 1),
    rotation: 0,
  }))
  const segmentHash = createSegmentHash(payload, session.id)

  return {
    id: `mock-segment-${payload.roomId}-${session.id}-${nowMs}`,
    roomId: payload.roomId,
    creatorId: payload.creatorId,
    startPoint: payload.startPoint,
    endPoint: payload.endPoint,
    placements: payload.placements,
    assetRefs,
    segmentHash,
    isValidated: false,
    submittedAt,
    validatedAt: null,
    clearTimeMs: null,
  }
}

function createSegmentHash(payload: SaveGameMapSegmentPayload, userId: string) {
  const rawValue = JSON.stringify({
    roomId: payload.roomId,
    userId,
    startPoint: payload.startPoint,
    endPoint: payload.endPoint,
    placements: payload.placements.map((placement) => [placement.asset.id, placement.x, placement.y]),
  })
  let hash = 0

  for (let index = 0; index < rawValue.length; index += 1) {
    hash = (hash * 31 + rawValue.charCodeAt(index)) >>> 0
  }

  return `segment-${hash.toString(16)}`
}

function areLatestRoomSegmentsRecorded(segments: MapSegmentSnapshot[], roomId: string) {
  const latestSegments = new Map<string, MapSegmentSnapshot>()

  for (const segment of segments) {
    if (segment.roomId !== roomId) {
      continue
    }

    const previousSegment = latestSegments.get(segment.creatorId)

    if (
      !previousSegment ||
      Date.parse(segment.submittedAt) >= Date.parse(previousSegment.submittedAt)
    ) {
      latestSegments.set(segment.creatorId, segment)
    }
  }

  return (
    latestSegments.size > 0 &&
    [...latestSegments.values()].every((segment) => segment.validatedAt !== null)
  )
}

function loadState(storage: GameRoomStorage): StoredGameRoomState {
  const rawValue = storage.getItem(storageKey)

  if (!rawValue) {
    return createSeedState()
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredGameRoomState>

    if (parsed.schemaVersion === 'mock-game-room-v1' && parsed.segments && parsed.mergedMaps) {
      return {
        schemaVersion: 'mock-game-room-v1',
        segments: parsed.segments,
        mergedMaps: parsed.mergedMaps,
        raceResults: parsed.raceResults ?? {},
      }
    }
  } catch {
    return createSeedState()
  }

  return createSeedState()
}

function saveState(storage: GameRoomStorage, state: StoredGameRoomState) {
  storage.setItem(storageKey, JSON.stringify(state))
}

function createSeedState(): StoredGameRoomState {
  return {
    schemaVersion: 'mock-game-room-v1',
    segments: {
      [mapSegment.id]: mapSegment,
    },
    mergedMaps: {
      [mergedMap.id]: mergedMap,
    },
    raceResults: {},
  }
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

function getDefaultStorage(): GameRoomStorage {
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
