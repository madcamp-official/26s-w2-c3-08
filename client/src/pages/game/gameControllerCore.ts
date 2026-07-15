import type {
  GameRealtime,
  RoomRealtime,
} from '../../domain/ports'
import type { LoginDataMode, LoginSession, StoragePort } from '../login/loginControllerCore'
import type {
  Asset,
  MapPlacement,
  MapSegmentSnapshot,
  MergedMap,
  RoomPhase,
  RacePositionSnapshot,
  RoomPlayer,
} from '../../types/domain'
import type { RaceResult } from 'shared/schemas'
import type {
  GameScreenFixture,
  MapBuildFixture,
  RaceFixture,
  ResultsFixture,
  ValidationFixture,
} from '../../fixtures/game/gameFixtures'

export type GameRouteKind = 'mapBuild' | 'validation' | 'merging' | 'race' | 'results'

export interface GameRouteState {
  kind: GameRouteKind
  roomId: string
  segmentId?: string
  mergedMapId?: string
}

export interface GameControllerError {
  kind:
    | 'validation'
    | 'authentication'
    | 'not_found'
    | 'conflict'
    | 'offline'
    | 'reconnecting'
    | 'server_unavailable'
    | 'malformed_response'
  message: string
  retryable: boolean
}

export type GameResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: GameControllerError
    }

export interface SaveGameMapSegmentPayload {
  roomId: string
  creatorId: string
  startPoint: MapBuildFixture['startPoint']
  endPoint: MapBuildFixture['endPoint']
  placements: MapPlacement[]
}

export type SaveGameMapSegmentValue = MapSegmentSnapshot & {
  roomPhase?: RoomPhase
}

export interface ValidateGameMapSegmentPayload {
  roomId: string
  userId: string
  segmentHash: string
  cleared: boolean
  clearTimeMs: number
}

export type ValidateGameMapSegmentValue = MapSegmentSnapshot & {
  roomPhase?: RoomPhase
}

export interface FinishGameRacePayload {
  roomId: string
  userId: string
  finishTimeMs: number
}

export interface SaveGameRaceProgressPayload {
  roomId: string
  userId: string
  progress: number
  raceDistanceToGoal: number
}

export type GameRaceResultValue = RaceResult & {
  roomPhase?: RoomPhase
}

export interface GameRoomSnapshot {
  roomId: string
  phase: RoomPhase
  phaseEndsAt: string | null
  players: Array<{
    userId: string
    nickname: string
    isHost: boolean
    isReady: boolean
    validationCleared?: boolean
    raceProgress?: number
    raceFinishedAtMs?: number | null
    raceDistanceToGoal?: number
    rank?: number
  }>
}

const mapBoardCols = 24
const mapBoardRows = 10
const raceResultPollIntervalMs = 250
const raceResultPollTimeoutMs = 12_000
const raceResultPollTimers = new WeakMap<
  GamePhaseControllerRuntime,
  ReturnType<typeof setInterval>
>()

export interface GameRoomPort {
  getRoomSnapshot(
    session: LoginSession,
    roomId: string,
    dataMode: LoginDataMode,
  ): Promise<GameResult<GameRoomSnapshot>>
  saveMapSegment(
    session: LoginSession,
    payload: SaveGameMapSegmentPayload,
    dataMode: LoginDataMode,
  ): Promise<GameResult<SaveGameMapSegmentValue>>
  getMapSegment(
    session: LoginSession,
    roomId: string,
    segmentId: string,
    dataMode: LoginDataMode,
  ): Promise<GameResult<MapSegmentSnapshot>>
  validateMapSegment(
    session: LoginSession,
    payload: ValidateGameMapSegmentPayload,
    dataMode: LoginDataMode,
  ): Promise<GameResult<ValidateGameMapSegmentValue>>
  mergeRoomMap(
    session: LoginSession,
    roomId: string,
    dataMode: LoginDataMode,
  ): Promise<GameResult<MergedMap>>
  getMergedMap(
    session: LoginSession,
    roomId: string,
    mergedMapId: string | null,
    dataMode: LoginDataMode,
  ): Promise<GameResult<MergedMap>>
  saveRaceProgress(
    session: LoginSession,
    payload: SaveGameRaceProgressPayload,
    dataMode: LoginDataMode,
  ): Promise<GameResult<GameRaceResultValue>>
  finishRace(
    session: LoginSession,
    payload: FinishGameRacePayload,
    dataMode: LoginDataMode,
  ): Promise<GameResult<GameRaceResultValue>>
  getRaceResults(
    session: LoginSession,
    roomId: string,
    dataMode: LoginDataMode,
  ): Promise<GameResult<GameRaceResultValue>>
}

export interface GameRoutePort {
  navigateLogin(): void
  navigateLobby(): void
  navigateRoom(roomId: string): void
  navigateMapBuild(roomId: string): void
  navigateValidation(roomId: string, segmentId?: string): void
  navigateMerging(roomId: string): void
  navigateRace(roomId: string, mergedMapId?: string): void
  navigateResults(roomId: string): void
}

export interface GamePhaseControllerState {
  session: LoginSession | null
  routeKind: GameRouteKind
  roomId: string
  assets: Asset[]
  placements: MapPlacement[]
  selectedAssetId: string
  selectedPlacementId: string
  tool: MapBuildFixture['tool']
  startPoint: MapBuildFixture['startPoint']
  endPoint: MapBuildFixture['endPoint']
  budgetUsed: number
  budgetLimit: number
  remainingMs: number | null
  players: RoomPlayer[]
  currentUserId: string
  mapBuildState: MapBuildFixture['state']
  validationState: ValidationFixture['state']
  mergingState: 'merging' | 'validatedSegments' | 'fallback' | 'error'
  raceState: RaceFixture['state']
  resultsState: ResultsFixture['state']
  message: string
  timeVoteText: string
  currentSegment: MapSegmentSnapshot | null
  segmentId: string | null
  mergedMap: MergedMap | null
  mergedMapId: string | null
  racePositions: Record<string, RacePositionSnapshot>
  raceElapsedSeconds: number
  isLocked: boolean
  resetSignal: number
  mergeProgress: number
  staleResults: boolean
}

export interface GamePhaseControllerRuntime {
  dataMode: LoginDataMode
  sessionStoragePort: StoragePort
  roomPort: GameRoomPort
  roomRealtime: RoomRealtime
  gameRealtime: GameRealtime
  routePort: GameRoutePort
  getState: () => GamePhaseControllerState
  setState: (updater: (state: GamePhaseControllerState) => GamePhaseControllerState) => void
}

export function createInitialGamePhaseControllerState(
  routeState: GameRouteState,
  fixture: GameScreenFixture,
): GamePhaseControllerState {
  const mapFixture = coerceMapBuildFixture(fixture)
  const validationFixture = coerceValidationFixture(fixture, mapFixture)
  const raceFixture = coerceRaceFixture(fixture, mapFixture)
  const resultsFixture = coerceResultsFixture(fixture, raceFixture)
  const mergingFixture = fixture.screenId === 'M_MERGING' ? fixture : null
  const message = 'message' in fixture ? fixture.message : '게임 상태를 불러왔어요.'

  return {
    session: null,
    routeKind: routeState.kind,
    roomId: routeState.roomId,
    assets: mapFixture.assets,
    placements: mapFixture.placements,
    selectedAssetId: mapFixture.selectedAssetId,
    selectedPlacementId: mapFixture.selectedPlacementId,
    tool: mapFixture.tool,
    startPoint: mapFixture.startPoint,
    endPoint: mapFixture.endPoint,
    budgetUsed: mapFixture.budgetUsed,
    budgetLimit: mapFixture.budgetLimit,
    remainingMs: 'remainingMs' in fixture ? fixture.remainingMs : null,
    players: 'players' in fixture ? fixture.players : mapFixture.players,
    currentUserId: raceFixture.currentUserId,
    mapBuildState: routeState.kind === 'mapBuild' ? mapFixture.state : 'locked',
    validationState: routeState.kind === 'validation' ? validationFixture.state : 'playing',
    mergingState: routeState.kind === 'merging' && mergingFixture ? mergingFixture.state : 'merging',
    raceState: routeState.kind === 'race' ? raceFixture.state : 'normal',
    resultsState: routeState.kind === 'results' ? resultsFixture.state : 'winner',
    message,
    timeVoteText: mapFixture.timeVoteText,
    currentSegment: routeState.kind === 'validation' ? validationFixture.segment : mapFixture.testSegment,
    segmentId:
      routeState.segmentId ??
      (routeState.kind === 'validation'
        ? validationFixture.segment?.id
        : mapFixture.testSegment.id) ??
      null,
    mergedMap:
      routeState.kind === 'race'
        ? raceFixture.mergedMap
        : routeState.kind === 'merging' && mergingFixture
          ? mergingFixture.mergedMap
          : null,
    mergedMapId:
      routeState.mergedMapId ??
      (routeState.kind === 'race'
        ? raceFixture.mergedMap?.id
        : routeState.kind === 'merging'
          ? mergingFixture?.mergedMap?.id
          : null) ??
      null,
    racePositions: raceFixture.racePositions,
    raceElapsedSeconds: routeState.kind === 'race' ? raceFixture.elapsedSeconds : 0,
    isLocked: mapFixture.isLocked,
    resetSignal: validationFixture.resetSignal,
    mergeProgress: mergingFixture?.progress ?? 0,
    staleResults: routeState.kind === 'results' ? resultsFixture.stale : false,
  }
}

export async function bootGamePhaseController(runtime: GamePhaseControllerRuntime) {
  const session = runtime.sessionStoragePort.loadSession()
  let phaseSyncTimer: ReturnType<typeof setInterval> | null = null
  let hostMergeRequested = false
  const requestHostMerge = () => {
    if (hostMergeRequested) {
      return
    }

    hostMergeRequested = true
    void mergeGameRoomMap(runtime)
  }

  runtime.setState((state) => ({
    ...state,
    session,
    currentUserId: session?.id ?? state.currentUserId,
  }))

  if (!session) {
    runtime.routePort.navigateLogin()
    return { destination: 'login' as const, reason: 'no_session' as const }
  }

  const snapshotResult = await loadGameRoomSnapshot(runtime)
  const sharedSession = toSharedSession(session)
  const roomResult = await runtime.roomRealtime.connect(sharedSession, {
    onStatusChange(status) {
      if (status === 'offline' || status === 'reconnecting' || status === 'error') {
        runtime.setState((state) => ({
          ...state,
          staleResults: true,
          message: status === 'reconnecting'
            ? '방 상태를 다시 연결하고 있어요.'
            : '방 실시간 연결이 끊어졌어요.',
        }))
      }
    },
    onRoomJoined(snapshot) {
      runtime.setState((state) => applyRoomSnapshot(state, snapshot.players, snapshot.phaseEndsAt))
    },
    onRoomStateChanged(snapshot) {
      runtime.setState((state) => applyRoomSnapshot(state, snapshot.players, snapshot.phaseEndsAt))
    },
    onPhaseChanged(payload) {
      const currentState = runtime.getState()
      const shouldHydrateMergedMap = payload.phase === 'racing' && !currentState.mergedMap

      if (
        payload.phase !== 'finished' &&
        (currentState.routeKind === 'results' || currentState.raceState === 'finish')
      ) {
        return
      }

      routeToPhase(runtime.routePort, payload.roomId, payload.phase)
      runtime.setState((state) => ({
        ...state,
        remainingMs: payload.phaseEndsAt ? Math.max(Date.parse(payload.phaseEndsAt) - Date.now(), 0) : null,
        raceElapsedSeconds: payload.phase === 'racing' ? state.raceElapsedSeconds : 0,
        raceState:
          payload.phase === 'racing' && payload.isOvertime
            ? 'overtime'
            : payload.phase === 'racing' && payload.isFinishCountdown
              ? 'playerFinished'
              : state.raceState,
        message:
          payload.phase === 'racing' && payload.isOvertime
            ? '라스트댄스 30초가 시작됐어요.'
            : payload.phase === 'racing' && payload.isFinishCountdown
              ? '1등 도착 · 10초 안에 골인하세요.'
            : `${getPhaseLabel(payload.phase)} 단계로 이동합니다.`,
      }))

      if (payload.phase === 'merging' && isCurrentPlayerHost(currentState)) {
        requestHostMerge()
      }

      if (shouldHydrateMergedMap) {
        void loadGameMergedMap(runtime)
      }
    },
    onTimerTick(payload) {
      runtime.setState((state) => ({
        ...state,
        raceElapsedSeconds:
          state.routeKind === 'race' && payload.phase === 'racing'
            ? state.raceElapsedSeconds + getElapsedDeltaSeconds(state.remainingMs, payload.remainingMs)
            : state.raceElapsedSeconds,
        remainingMs: payload.remainingMs,
      }))
    },
    onTimeVoteUpdated(payload) {
      runtime.setState((state) => ({
        ...state,
        timeVoteText: payload.applied
          ? `${payload.deltaSec > 0 ? '+' : ''}${payload.deltaSec}초 반영`
          : '시간 투표 대기 중',
        remainingMs: payload.remainingMs ?? state.remainingMs,
      }))
    },
    onSegmentSubmitted(payload) {
      runtime.setState((state) => ({
        ...state,
        message: `${payload.userId}의 맵 조각 제출을 받았어요.`,
      }))
    },
    onValidationResult(payload) {
      runtime.setState((state) => ({
        ...state,
        players: state.players.map((player) =>
          player.id === payload.userId
            ? { ...player, validationCleared: payload.cleared }
            : player,
        ),
        message: payload.cleared ? '검증 성공 기록을 받았어요.' : '검증 실패 기록을 받았어요.',
      }))
    },
    onMapMerged(payload) {
      runtime.setState((state) => {
        if (payload.roomId && payload.roomId !== state.roomId) {
          return state
        }

        return {
          ...state,
          mergedMapId: payload.id,
          mergingState: payload.usedFallback ? 'fallback' : 'validatedSegments',
          mergeProgress: 100,
          message: payload.usedFallback
            ? '검증 성공 세그먼트가 없어 기본 세그먼트를 사용합니다.'
            : '검증 성공 세그먼트를 병합했어요.',
        }
      })

      const currentState = runtime.getState()
      const shouldHydrateMergedMap =
        (!payload.roomId || payload.roomId === currentState.roomId) &&
        (!currentState.mergedMap || currentState.mergedMap.id !== payload.id)

      if (shouldHydrateMergedMap) {
        void loadGameMergedMap(runtime)
      }
    },
    onResultsFinal(result) {
      runtime.routePort.navigateResults(result.roomId)
      runtime.setState((state) => ({
        ...applyRaceResult(state, result),
        raceState: 'finish',
        message: '최종 결과를 받았어요.',
      }))
    },
  })

  if (!roomResult.ok) {
    runtime.setState((state) => ({
      ...state,
      staleResults: true,
      message: roomResult.error.message,
    }))
  } else {
    runtime.roomRealtime.joinRoom({
      roomId: runtime.getState().roomId,
      userId: session.id,
      nickname: session.nickname,
    })
  }

  const unsubscribe = runtime.gameRealtime.subscribe({
    onRacePosition(payload) {
      runtime.setState((state) => ({
        ...state,
        racePositions: {
          ...state.racePositions,
          [payload.userId]: {
            userId: payload.userId,
            x: payload.x,
            y: payload.y,
            vx: payload.vx,
            vy: payload.vy,
            state: payload.state,
            progress: payload.progress,
            clientTime: payload.clientTime,
          },
        },
        players: state.players.map((player) =>
          player.id === payload.userId
            ? { ...player, raceProgress: payload.progress }
            : player,
        ),
      }))
    },
    onRaceFinished(payload) {
      runtime.setState((state) => ({
        ...state,
        players: state.players.map((player) =>
          player.id === payload.userId
            ? {
                ...player,
                raceProgress: 100,
                raceFinishedAtMs: payload.finishTimeMs,
                raceDistanceToGoal: 0,
              }
            : player,
        ),
      }))
    },
  })

  if (runtime.getState().routeKind === 'results') {
    void loadGameRaceResults(runtime)
  }

  if (runtime.getState().routeKind === 'merging' && isCurrentPlayerHost(runtime.getState())) {
    requestHostMerge()
  }

  if (runtime.getState().routeKind === 'merging' && !isCurrentPlayerHost(runtime.getState())) {
    phaseSyncTimer = setInterval(() => {
      if (runtime.getState().routeKind === 'merging') {
        void loadGameRoomSnapshot(runtime)
      }
    }, 500)
  }

  if (runtime.getState().routeKind === 'validation' && runtime.dataMode === 'remote') {
    phaseSyncTimer = setInterval(() => {
      if (runtime.getState().routeKind === 'validation') {
        void loadGameRoomSnapshot(runtime)
      }
    }, 500)
  }

  if (
    runtime.getState().routeKind === 'validation' &&
    runtime.getState().segmentId &&
    runtime.getState().currentSegment?.id !== runtime.getState().segmentId
  ) {
    void loadGameMapSegment(runtime)
  }

  if (runtime.getState().routeKind === 'race' && !runtime.getState().mergedMap) {
    void loadGameMergedMap(runtime)
  }

  return {
    destination: runtime.getState().routeKind,
    reason: roomResult.ok ? 'connected' as const : snapshotResult.ok ? 'snapshot_only' as const : 'realtime_error' as const,
    dispose: () => {
      if (phaseSyncTimer !== null) {
        clearInterval(phaseSyncTimer)
      }

      clearRaceResultPolling(runtime)
      unsubscribe()
      runtime.roomRealtime.disconnect()
    },
  }
}

export async function loadGameRoomSnapshot(runtime: GamePhaseControllerRuntime) {
  const state = runtime.getState()
  const session = state.session

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  const result = await runtime.roomPort.getRoomSnapshot(
    session,
    state.roomId,
    runtime.dataMode,
  )

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      staleResults: true,
      message: result.error.message,
    }))

    return { ok: false as const, reason: 'error' as const }
  }

  const snapshot = result.value
  const expectedPhase = toRoomPhase(state.routeKind)
  const shouldRoute = snapshot.phase !== expectedPhase

  runtime.setState((current) => ({
    ...applyGameRoomSnapshot(current, snapshot),
    message: shouldRoute
      ? `${getPhaseLabel(snapshot.phase)} 단계로 이동합니다.`
      : '방 상태를 동기화했어요.',
  }))

  if (shouldRoute) {
    routeToPhase(runtime.routePort, snapshot.roomId, snapshot.phase)
  }

  return { ok: true as const, phase: snapshot.phase }
}

export async function loadGameMapSegment(runtime: GamePhaseControllerRuntime) {
  const state = runtime.getState()
  const session = state.session
  const segmentId = state.segmentId

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false, reason: 'no_session' as const }
  }

  if (!segmentId) {
    runtime.setState((current) => ({
      ...current,
      validationState: 'noSegment',
      message: '검증할 맵 스냅샷이 없습니다.',
    }))

    return { ok: false, reason: 'no_segment' as const }
  }

  const result = await runtime.roomPort.getMapSegment(
    session,
    state.roomId,
    segmentId,
    runtime.dataMode,
  )

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      validationState: 'noSegment',
      message: result.error.message,
    }))

    return { ok: false, reason: 'error' as const }
  }

  runtime.setState((current) => ({
    ...current,
    currentSegment: result.value,
    segmentId: result.value.id,
    placements: result.value.placements,
    startPoint: result.value.startPoint,
    endPoint: result.value.endPoint,
    validationState: result.value.isValidated ? 'cleared' : 'playing',
    message: '저장된 맵 스냅샷을 불러왔어요.',
  }))

  return { ok: true, segmentId: result.value.id }
}

export async function loadGameMergedMap(runtime: GamePhaseControllerRuntime) {
  const state = runtime.getState()
  const session = state.session

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false, reason: 'no_session' as const }
  }

  const result = await runtime.roomPort.getMergedMap(
    session,
    state.roomId,
    state.mergedMapId,
    runtime.dataMode,
  )

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      raceState: 'missingMap',
      message: result.error.message,
    }))

    return { ok: false, reason: 'error' as const }
  }

  runtime.setState((current) => ({
    ...current,
    mergedMap: result.value,
    mergedMapId: result.value.id,
    raceState: current.routeKind === 'race' && current.raceState === 'missingMap'
      ? 'normal'
      : current.raceState,
    message: '레이스 맵을 불러왔어요.',
  }))

  return { ok: true, mergedMapId: result.value.id }
}

export async function loadGameRaceResults(runtime: GamePhaseControllerRuntime) {
  const state = runtime.getState()
  const session = state.session

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false, reason: 'no_session' as const }
  }

  const result = await runtime.roomPort.getRaceResults(session, state.roomId, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      staleResults: true,
      message: result.error.message,
    }))

    return { ok: false, reason: 'error' as const }
  }

  runtime.setState((current) => applyRaceResult(current, result.value))

  return { ok: true, result: result.value }
}

export function selectGameAsset(runtime: GamePhaseControllerRuntime, assetId: string) {
  runtime.setState((state) => ({
    ...state,
    selectedAssetId: assetId,
    mapBuildState: 'selectedAsset',
    message: '에셋 선택 변경',
  }))
}

export function selectGameTool(runtime: GamePhaseControllerRuntime, tool: MapBuildFixture['tool']) {
  runtime.setState((state) => ({
    ...state,
    tool,
    message: `${getToolLabel(tool)} 도구 선택`,
  }))
}

export function handleGameMapCell(runtime: GamePhaseControllerRuntime, x: number, y: number) {
  if (!isMapCellInsideBoard(x, y)) {
    return
  }

  runtime.setState((state) => applyMapCellInteraction(state, x, y))
}

export function dropGameMapAsset(
  runtime: GamePhaseControllerRuntime,
  assetId: string,
  x: number,
  y: number,
) {
  if (!isMapCellInsideBoard(x, y)) {
    return
  }

  runtime.setState((state) => {
    const asset = state.assets.find((candidate) => candidate.id === assetId)

    if (!asset) {
      return {
        ...state,
        mapBuildState: 'placementDenied',
        message: '드롭한 에셋을 찾을 수 없어요.',
      }
    }

    return placeMapAsset(state, asset, x, y)
  })
}

export function requestGameTimeVote(runtime: GamePhaseControllerRuntime, deltaSec: number) {
  const state = runtime.getState()
  const session = state.session

  if (!session) {
    runtime.routePort.navigateLogin()
    return
  }

  runtime.roomRealtime.requestTimeVote({
    roomId: state.roomId,
    userId: session.id,
    phase: toRoomPhase(state.routeKind),
    deltaSec,
  })
  runtime.setState((current) => ({
    ...current,
    mapBuildState: current.routeKind === 'mapBuild' ? 'timeVotePending' : current.mapBuildState,
    timeVoteText: `${deltaSec > 0 ? '+' : ''}${deltaSec}초 시간 투표 요청`,
  }))
}

export function openBuildTest(runtime: GamePhaseControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    mapBuildState: 'buildTest',
    message: '테스트 modal에서 PlaytestCanvas를 실행합니다.',
  }))
}

export function closeBuildTest(runtime: GamePhaseControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    mapBuildState: state.isLocked ? 'locked' : 'editing',
  }))
}

export async function submitGameMapBuild(runtime: GamePhaseControllerRuntime) {
  const state = runtime.getState()
  const session = state.session

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false, reason: 'no_session' as const }
  }

  runtime.setState((current) => ({
    ...current,
    mapBuildState: 'submitPending',
    message: '맵 스냅샷을 저장하는 중입니다.',
  }))

  const result = await runtime.roomPort.saveMapSegment(
    session,
    {
      roomId: state.roomId,
      creatorId: session.id,
      startPoint: state.startPoint,
      endPoint: state.endPoint,
      placements: state.placements,
    },
    runtime.dataMode,
  )

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      mapBuildState: 'editing',
      message: result.error.message,
    }))
    return { ok: false, reason: 'error' as const }
  }

  runtime.roomRealtime.submitSegment({
    roomId: state.roomId,
    userId: session.id,
    segmentId: result.value.id,
  })
  runtime.roomRealtime.markPhaseReady({
    roomId: state.roomId,
    userId: session.id,
    phase: 'building',
  })
  runtime.setState((current) => ({
    ...current,
    currentSegment: result.value,
    segmentId: result.value.id,
    mapBuildState: 'submitComplete',
    isLocked: true,
    message: result.value.roomPhase === 'validating'
      ? '맵 잠김 · 저장된 스냅샷을 검증합니다.'
      : '맵 잠김 · 다른 플레이어의 제출을 기다립니다.',
    players: current.players.map((player) =>
      player.id === session.id ? { ...player, isReady: true } : player,
    ),
  }))

  if (result.value.roomPhase === 'validating') {
    runtime.routePort.navigateValidation(state.roomId, result.value.id)
  }

  return { ok: true, segmentId: result.value.id }
}

export function resetGameValidation(runtime: GamePhaseControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    validationState: 'playing',
    resetSignal: state.resetSignal + 1,
    message: '처음부터 다시 시작합니다.',
  }))
}

export async function recordGameValidation(runtime: GamePhaseControllerRuntime, cleared: boolean) {
  const state = runtime.getState()
  const session = state.session
  const segment = state.currentSegment

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false, reason: 'no_session' as const }
  }

  if (!segment) {
    runtime.setState((current) => ({
      ...current,
      validationState: 'noSegment',
      message: '검증할 맵 스냅샷이 없습니다.',
    }))
    return { ok: false, reason: 'no_segment' as const }
  }

  const clearTimeMs = cleared ? 61_400 : 0
  const result = await runtime.roomPort.validateMapSegment(
    session,
    {
      roomId: state.roomId,
      userId: session.id,
      segmentHash: segment.segmentHash,
      cleared,
      clearTimeMs,
    },
    runtime.dataMode,
  )

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      message: result.error.message,
    }))
    return { ok: false, reason: 'error' as const }
  }

  runtime.roomRealtime.publishValidationResult({
    roomId: state.roomId,
    userId: session.id,
    cleared,
    segmentHash: result.value.segmentHash,
    clearTimeMs,
  })
  runtime.roomRealtime.markPhaseReady({
    roomId: state.roomId,
    userId: session.id,
    phase: 'validating',
  })
  runtime.setState((current) => ({
    ...current,
    currentSegment: result.value,
    segmentId: result.value.id,
    validationState: cleared ? 'cleared' : 'failedRecorded',
    message: result.value.roomPhase === 'merging'
      ? '검증 기록 완료 · 병합 단계로 이동합니다.'
      : cleared
        ? '검증 성공 기록 완료 · 다른 플레이어 대기'
        : '검증 실패 기록 완료 · 다른 플레이어 대기',
    players: current.players.map((player) =>
      player.id === session.id
        ? { ...player, isReady: true, validationCleared: cleared }
        : player,
    ),
  }))

  if (result.value.roomPhase === 'merging') {
    runtime.routePort.navigateMerging(state.roomId)
  }

  return { ok: true, cleared }
}

export async function mergeGameRoomMap(runtime: GamePhaseControllerRuntime) {
  const state = runtime.getState()
  const session = state.session

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false, reason: 'no_session' as const }
  }

  runtime.setState((current) => ({
    ...current,
    mergingState: 'merging',
    mergeProgress: 45,
    message: '검증 성공 세그먼트를 이어붙이고 있어요.',
  }))

  const result = await runtime.roomPort.mergeRoomMap(session, state.roomId, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      mergingState: 'error',
      message: result.error.message,
    }))
    return { ok: false, reason: 'error' as const }
  }

  runtime.roomRealtime.markPhaseReady({
    roomId: state.roomId,
    userId: session.id,
    phase: 'merging',
  })
  runtime.setState((current) => ({
    ...current,
    mergedMap: result.value,
    mergedMapId: result.value.id,
    mergingState: result.value.usedFallback ? 'fallback' : 'validatedSegments',
    mergeProgress: 100,
    message: result.value.usedFallback
      ? '검증 성공 세그먼트가 없어 기본 세그먼트를 사용합니다.'
      : '검증 성공 세그먼트를 병합했어요.',
  }))
  runtime.routePort.navigateRace(state.roomId, result.value.id)

  return { ok: true, mergedMapId: result.value.id }
}

export function publishGameRaceProgress(
  runtime: GamePhaseControllerRuntime,
  progressById: Record<string, number>,
  localPosition?: Omit<RacePositionSnapshot, 'userId'>,
) {
  const state = runtime.getState()
  const session = state.session

  if (!session || !localPosition) {
    return
  }

  const progress = progressById[session.id] ?? localPosition.progress
  runtime.gameRealtime.sendRacePosition({
    roomId: state.roomId,
    userId: session.id,
    x: localPosition.x,
    y: localPosition.y,
    vx: localPosition.vx,
    vy: localPosition.vy,
    state: localPosition.state,
    progress,
    clientTime: localPosition.clientTime,
  })
  void runtime.roomPort.saveRaceProgress(
    session,
    {
      roomId: state.roomId,
      userId: session.id,
      progress,
      raceDistanceToGoal: Math.max(0, 100 - progress),
    },
    runtime.dataMode,
  ).then((result) => {
    if (!result.ok) {
      runtime.setState((current) => ({
        ...current,
        staleResults: true,
        message: result.error.message,
      }))
    }
  })
  runtime.setState((current) => ({
    ...current,
    players: current.players.map((player) =>
      player.id === session.id
        ? {
            ...player,
            raceProgress: progress,
            raceDistanceToGoal: Math.max(0, 100 - progress),
          }
        : player,
    ),
    message: `내 진행률 ${Math.round(progress)}%`,
  }))
}

export async function finishGameRace(runtime: GamePhaseControllerRuntime) {
  const state = runtime.getState()
  const session = state.session

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false, reason: 'no_session' as const }
  }

  const finishTimeMs = Math.max(0, Date.now() - 1_000)
  const result = await runtime.roomPort.finishRace(
    session,
    {
      roomId: state.roomId,
      userId: session.id,
      finishTimeMs,
    },
    runtime.dataMode,
  )

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      staleResults: true,
      message: result.error.message,
    }))

    return { ok: false, reason: 'error' as const }
  }

  runtime.gameRealtime.finishRace({
    roomId: state.roomId,
    userId: session.id,
    finishTimeMs,
  })
  runtime.setState((current) => ({
    ...applyRaceResult(current, result.value),
    raceState: result.value.roomPhase === 'finished' ? 'finish' : 'playerFinished',
    message: result.value.roomPhase === 'finished'
      ? '완주 기록을 받았어요.'
      : '완주 기록을 받았어요. 다른 플레이어를 기다립니다.',
  }))

  if (result.value.roomPhase === 'finished') {
    clearRaceResultPolling(runtime)
    runtime.routePort.navigateResults(state.roomId)
  } else {
    startRaceResultPolling(runtime)
  }

  return { ok: true, result: result.value }
}

function startRaceResultPolling(runtime: GamePhaseControllerRuntime) {
  if (runtime.dataMode !== 'remote' || raceResultPollTimers.has(runtime)) {
    return
  }

  const startedAt = Date.now()
  const poll = () => {
    if (Date.now() - startedAt > raceResultPollTimeoutMs) {
      clearRaceResultPolling(runtime)
      return
    }

    const state = runtime.getState()

    if (state.routeKind !== 'race' && state.routeKind !== 'results') {
      clearRaceResultPolling(runtime)
      return
    }

    void loadGameRaceResults(runtime).then((pollResult) => {
      if (!pollResult.ok) {
        return
      }

      clearRaceResultPolling(runtime)
      runtime.routePort.navigateResults(runtime.getState().roomId)
      runtime.setState((current) => ({
        ...current,
        raceState: 'finish',
        message: '최종 결과를 받았어요.',
      }))
    })
  }

  raceResultPollTimers.set(runtime, setInterval(poll, raceResultPollIntervalMs))
  poll()
}

function clearRaceResultPolling(runtime: GamePhaseControllerRuntime) {
  const timer = raceResultPollTimers.get(runtime)

  if (timer === undefined) {
    return
  }

  clearInterval(timer)
  raceResultPollTimers.delete(runtime)
}

function applyRaceResult(state: GamePhaseControllerState, result: RaceResult): GamePhaseControllerState {
  return {
    ...state,
    players: result.players.map((player) => ({
      id: player.userId,
      nickname: player.nickname,
      isHost: player.isHost,
      isReady: true,
      validationCleared: player.validationCleared,
      raceProgress: player.raceProgress,
      raceFinishedAtMs: player.raceFinishedAtMs,
      raceDistanceToGoal: player.raceDistanceToGoal,
      raceRank: player.rank,
    })),
    resultsState: 'winner',
    staleResults: false,
  }
}

function isCurrentPlayerHost(state: GamePhaseControllerState) {
  return state.players.some((player) => player.id === state.currentUserId && player.isHost)
}

function applyMapCellInteraction(
  state: GamePhaseControllerState,
  x: number,
  y: number,
): GamePhaseControllerState {
  if (state.isLocked || state.mapBuildState === 'locked' || state.mapBuildState === 'submitComplete') {
    return state
  }

  if (state.tool === 'select') {
    return selectMapPlacementAtCell(state, x, y)
  }

  if (state.tool === 'erase') {
    return eraseMapPlacementAtCell(state, x, y)
  }

  if (state.tool === 'start') {
    return moveMapEndpoint(state, 'start', x, y)
  }

  if (state.tool === 'goal') {
    return moveMapEndpoint(state, 'goal', x, y)
  }

  if (state.tool === 'move') {
    if (state.selectedPlacementId === '') {
      return selectMapPlacementAtCell(state, x, y)
    }

    const selectedPlacement = state.placements.find((placement) => placement.id === state.selectedPlacementId)

    if (!selectedPlacement) {
      return {
        ...state,
        selectedPlacementId: '',
        mapBuildState: 'placementDenied',
        message: '이동할 배치를 다시 선택해주세요.',
      }
    }

    return moveMapPlacement(state, selectedPlacement, x, y)
  }

  const selectedAsset = state.assets.find((asset) => asset.id === state.selectedAssetId)

  if (!selectedAsset) {
    return {
      ...state,
      mapBuildState: 'placementDenied',
      message: '먼저 배치할 에셋을 선택해주세요.',
    }
  }

  return placeMapAsset(state, selectedAsset, x, y)
}

function selectMapPlacementAtCell(
  state: GamePhaseControllerState,
  x: number,
  y: number,
): GamePhaseControllerState {
  const placement = getPlacementAtCell(state.placements, x, y)

  if (!placement) {
    return {
      ...state,
      selectedPlacementId: '',
      mapBuildState: 'editing',
      message: '선택된 배치를 해제했어요.',
    }
  }

  return {
    ...state,
    selectedAssetId: placement.asset.id,
    selectedPlacementId: placement.id,
    mapBuildState: 'selectedAsset',
    message: `${placement.asset.name} 배치를 선택했어요.`,
  }
}

function eraseMapPlacementAtCell(
  state: GamePhaseControllerState,
  x: number,
  y: number,
): GamePhaseControllerState {
  const placement = getPlacementAtCell(state.placements, x, y)

  if (!placement) {
    return {
      ...state,
      mapBuildState: 'placementDenied',
      message: '삭제할 배치가 없어요.',
    }
  }

  return withDraftSegment({
    ...state,
    placements: state.placements.filter((candidate) => candidate.id !== placement.id),
    selectedPlacementId: state.selectedPlacementId === placement.id ? '' : state.selectedPlacementId,
    budgetUsed: Math.max(0, state.budgetUsed - 1),
    mapBuildState: 'editing',
    message: `${placement.asset.name} 배치를 삭제했어요.`,
  })
}

function moveMapEndpoint(
  state: GamePhaseControllerState,
  endpoint: 'start' | 'goal',
  x: number,
  y: number,
): GamePhaseControllerState {
  if (getPlacementAtCell(state.placements, x, y)) {
    return {
      ...state,
      mapBuildState: 'placementDenied',
      message: '배치가 있는 칸에는 시작/목표를 둘 수 없어요.',
    }
  }

  if (endpoint === 'start' && state.endPoint.x === x && state.endPoint.y === y) {
    return {
      ...state,
      mapBuildState: 'placementDenied',
      message: '시작점과 목표점은 같은 칸일 수 없어요.',
    }
  }

  if (endpoint === 'goal' && state.startPoint.x === x && state.startPoint.y === y) {
    return {
      ...state,
      mapBuildState: 'placementDenied',
      message: '목표점과 시작점은 같은 칸일 수 없어요.',
    }
  }

  return withDraftSegment({
    ...state,
    startPoint: endpoint === 'start' ? { x, y } : state.startPoint,
    endPoint: endpoint === 'goal' ? { x, y } : state.endPoint,
    selectedPlacementId: '',
    mapBuildState: 'editing',
    message: endpoint === 'start' ? '시작점을 옮겼어요.' : '목표점을 옮겼어요.',
  })
}

function moveMapPlacement(
  state: GamePhaseControllerState,
  placement: MapPlacement,
  x: number,
  y: number,
): GamePhaseControllerState {
  const nextPlacement = { ...placement, x, y }
  const candidatePlacements = state.placements.map((candidate) =>
    candidate.id === placement.id ? nextPlacement : candidate,
  )

  if (!canPlaceMapAsset(candidatePlacements, nextPlacement, state.startPoint, state.endPoint, placement.id)) {
    return {
      ...state,
      mapBuildState: 'placementDenied',
      message: '그 위치로 이동할 수 없어요.',
    }
  }

  return withDraftSegment({
    ...state,
    placements: candidatePlacements,
    mapBuildState: 'selectedAsset',
    message: `${placement.asset.name} 배치를 이동했어요.`,
  })
}

function placeMapAsset(
  state: GamePhaseControllerState,
  asset: Asset,
  x: number,
  y: number,
): GamePhaseControllerState {
  if (state.budgetUsed >= state.budgetLimit) {
    return {
      ...state,
      mapBuildState: 'placementDenied',
      message: '예산을 모두 사용했어요.',
    }
  }

  const placement: MapPlacement = {
    id: createMapPlacementId(asset.id),
    x,
    y,
    asset,
  }

  if (!canPlaceMapAsset(state.placements, placement, state.startPoint, state.endPoint)) {
    return {
      ...state,
      mapBuildState: 'placementDenied',
      message: '그 위치에는 배치할 수 없어요.',
    }
  }

  return withDraftSegment({
    ...state,
    placements: [...state.placements, placement],
    selectedAssetId: asset.id,
    selectedPlacementId: placement.id,
    budgetUsed: state.budgetUsed + 1,
    mapBuildState: 'selectedAsset',
    message: `${asset.name} 배치를 추가했어요.`,
  })
}

function withDraftSegment(state: GamePhaseControllerState): GamePhaseControllerState {
  return {
    ...state,
    currentSegment: createDraftSegmentSnapshot(state),
  }
}

function createDraftSegmentSnapshot(state: GamePhaseControllerState): MapSegmentSnapshot {
  const submittedAt = state.currentSegment?.submittedAt ?? new Date(0).toISOString()

  return {
    id: state.currentSegment?.id ?? `draft-${state.roomId}`,
    roomId: state.roomId,
    creatorId: state.session?.id ?? state.currentUserId,
    startPoint: state.startPoint,
    endPoint: state.endPoint,
    placements: state.placements,
    assetRefs: state.placements.map((placement) => ({
      assetId: placement.asset.id,
      assetCategory: placement.asset.category,
      assetAttrs: placement.asset.attrs,
      colliderType: placement.asset.colliderType,
      x: placement.x,
      y: placement.y,
      widthCells: Math.max(1, placement.asset.widthCells ?? 1),
      heightCells: Math.max(1, placement.asset.heightCells ?? 1),
      rotation: 0,
    })),
    segmentHash: createDraftSegmentHash(state),
    isValidated: false,
    submittedAt,
    validatedAt: null,
    clearTimeMs: null,
  }
}

function createDraftSegmentHash(state: GamePhaseControllerState) {
  const value = JSON.stringify({
    start: state.startPoint,
    end: state.endPoint,
    placements: state.placements.map((placement) => ({
      id: placement.asset.id,
      x: placement.x,
      y: placement.y,
      w: placement.asset.widthCells ?? 1,
      h: placement.asset.heightCells ?? 1,
    })),
  })
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }

  return `draft-${Math.abs(hash).toString(36)}`
}

function createMapPlacementId(assetId: string) {
  return `placement-${assetId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

function canPlaceMapAsset(
  placements: MapPlacement[],
  placement: MapPlacement,
  startPoint: MapBuildFixture['startPoint'],
  endPoint: MapBuildFixture['endPoint'],
  ignorePlacementId = '',
) {
  const rect = getPlacementRect(placement)

  if (!isRectInsideMapBoard(rect)) {
    return false
  }

  if (doesRectCoverPoint(rect, startPoint) || doesRectCoverPoint(rect, endPoint)) {
    return false
  }

  return !placements
    .filter((candidate) => candidate.id !== ignorePlacementId)
    .some((candidate) => doMapRectsOverlap(rect, getPlacementRect(candidate)))
}

function getPlacementAtCell(placements: MapPlacement[], x: number, y: number) {
  return [...placements]
    .reverse()
    .find((placement) => doesRectCoverPoint(getPlacementRect(placement), { x, y }))
}

function getPlacementRect(placement: MapPlacement) {
  return {
    x: placement.x,
    y: placement.y,
    width: Math.max(1, placement.asset.widthCells ?? 1),
    height: Math.max(1, placement.asset.heightCells ?? 1),
  }
}

function isMapCellInsideBoard(x: number, y: number) {
  return x >= 0 && x < mapBoardCols && y >= 0 && y < mapBoardRows
}

function isRectInsideMapBoard(rect: { x: number; y: number; width: number; height: number }) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= mapBoardCols &&
    rect.y + rect.height <= mapBoardRows
  )
}

function doesRectCoverPoint(
  rect: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number },
) {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  )
}

function doMapRectsOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

function applyRoomSnapshot(
  state: GamePhaseControllerState,
  players: Array<{
    userId: string
    nickname: string
    isHost: boolean
    isReady?: boolean
    validationCleared?: boolean
    raceProgress?: number
    raceFinishedAtMs?: number | null
    raceDistanceToGoal?: number
    rank?: number
  }>,
  phaseEndsAt: string | null,
): GamePhaseControllerState {
  return applyGameRoomSnapshot(state, {
    roomId: state.roomId,
    phase: toRoomPhase(state.routeKind),
    phaseEndsAt,
    players: players.map((player) => ({
      ...player,
      isReady: player.isReady ?? (player.validationCleared === true || player.raceFinishedAtMs !== null),
    })),
  })
}

function applyGameRoomSnapshot(
  state: GamePhaseControllerState,
  snapshot: GameRoomSnapshot,
): GamePhaseControllerState {
  const previousPlayers = new Map(state.players.map((player) => [player.id, player]))

  return {
    ...state,
    roomId: snapshot.roomId,
    remainingMs: snapshot.phaseEndsAt ? Math.max(Date.parse(snapshot.phaseEndsAt) - Date.now(), 0) : state.remainingMs,
    players: snapshot.players.map((player) => {
      const previousPlayer = previousPlayers.get(player.userId)
      const raceFinishedAtMs = player.raceFinishedAtMs ?? previousPlayer?.raceFinishedAtMs ?? null

      return {
        id: player.userId,
        nickname: player.nickname,
        isHost: player.isHost,
        isReady: player.isReady,
        validationCleared: player.validationCleared ?? previousPlayer?.validationCleared ?? false,
        raceProgress: player.raceProgress ?? previousPlayer?.raceProgress ?? 0,
        raceFinishedAtMs,
        raceDistanceToGoal: player.raceDistanceToGoal ?? previousPlayer?.raceDistanceToGoal ?? 100,
        raceRank: player.rank ?? previousPlayer?.raceRank,
      }
    }),
  }
}

function routeToPhase(routePort: GameRoutePort, roomId: string, phase: string) {
  if (phase === 'lobby') {
    routePort.navigateRoom(roomId)
    return
  }

  if (phase === 'building') {
    routePort.navigateMapBuild(roomId)
    return
  }

  if (phase === 'validating') {
    routePort.navigateValidation(roomId)
    return
  }

  if (phase === 'merging') {
    routePort.navigateMerging(roomId)
    return
  }

  if (phase === 'racing') {
    routePort.navigateRace(roomId)
    return
  }

  if (phase === 'finished') {
    routePort.navigateResults(roomId)
  }
}

function toRoomPhase(routeKind: GameRouteKind) {
  if (routeKind === 'mapBuild') {
    return 'building'
  }

  if (routeKind === 'validation') {
    return 'validating'
  }

  if (routeKind === 'race') {
    return 'racing'
  }

  if (routeKind === 'results') {
    return 'finished'
  }

  return 'merging'
}

function getElapsedDeltaSeconds(previousRemainingMs: number | null, nextRemainingMs: number) {
  if (previousRemainingMs === null || nextRemainingMs >= previousRemainingMs) {
    return 0
  }

  return (previousRemainingMs - nextRemainingMs) / 1000
}

function toSharedSession(session: LoginSession) {
  return {
    id: session.id,
    nickname: session.nickname,
    token: session.token,
    avatarAssetId: session.avatarAssetId ?? null,
  }
}

function getPhaseLabel(phase: string) {
  const labels: Record<string, string> = {
    building: '맵 제작',
    validating: '검증',
    merging: '병합',
    racing: '레이스',
    finished: '결과',
  }

  return labels[phase] ?? phase
}

function getToolLabel(tool: string) {
  const labels: Record<string, string> = {
    select: '선택',
    place: '배치',
    move: '이동',
    erase: '삭제',
    start: '시작점',
    goal: '끝점',
  }

  return labels[tool] ?? tool
}

function coerceMapBuildFixture(fixture: GameScreenFixture): MapBuildFixture {
  if (fixture.screenId === 'S4_MAP_BUILD') {
    return fixture
  }

  const segment = 'segment' in fixture && fixture.segment ? fixture.segment : null

  return {
    id: 'derived-map-build',
    screenId: 'S4_MAP_BUILD',
    title: '맵 제작',
    description: 'route state에서 파생한 맵 제작 상태입니다.',
    state: 'locked',
    viewport: fixture.viewport,
    roomId: fixture.roomId,
    remainingMs: 'remainingMs' in fixture ? fixture.remainingMs : null,
    budgetUsed: segment?.placements.length ?? 0,
    budgetLimit: 24,
    assets: segment?.placements.map((placement) => placement.asset) ?? [],
    placements: segment?.placements ?? [],
    selectedAssetId: segment?.placements[0]?.asset.id ?? '',
    selectedPlacementId: '',
    tool: 'select',
    startPoint: segment?.startPoint ?? { x: 1, y: 7 },
    endPoint: segment?.endPoint ?? { x: 22, y: 7 },
    isLocked: true,
    message: 'route state에서 제작 스냅샷을 불러왔어요.',
    timeVoteText: '시간 투표 가능',
    players: 'players' in fixture ? fixture.players : [],
    testSegment: segment ?? createEmptySegment(fixture.roomId),
  }
}

function coerceValidationFixture(
  fixture: GameScreenFixture,
  mapFixture: MapBuildFixture,
): ValidationFixture {
  if (fixture.screenId === 'D_VALIDATION') {
    return fixture
  }

  return {
    id: 'derived-validation',
    screenId: 'D_VALIDATION',
    title: '검증',
    description: 'route state에서 파생한 검증 상태입니다.',
    state: mapFixture.testSegment ? 'playing' : 'noSegment',
    viewport: fixture.viewport,
    roomId: fixture.roomId,
    remainingMs: 'remainingMs' in fixture ? fixture.remainingMs : null,
    segment: mapFixture.testSegment,
    players: 'players' in fixture ? fixture.players : mapFixture.players,
    isCleared: mapFixture.testSegment.isValidated,
    resetSignal: 0,
    message: 'GOAL에 닿으면 검증 성공으로 기록됩니다.',
  }
}

function coerceRaceFixture(
  fixture: GameScreenFixture,
  mapFixture: MapBuildFixture,
): RaceFixture {
  if (fixture.screenId === 'E_RACE') {
    return fixture
  }

  const mergedMap = fixture.screenId === 'M_MERGING' ? fixture.mergedMap : null

  return {
    id: 'derived-race',
    screenId: 'E_RACE',
    title: '레이스',
    description: 'route state에서 파생한 레이스 상태입니다.',
    state: mergedMap ? 'normal' : 'missingMap',
    viewport: fixture.viewport,
    roomId: fixture.roomId,
    remainingMs: 'remainingMs' in fixture ? fixture.remainingMs : null,
    elapsedSeconds: 0,
    isExtended: false,
    currentUserId: mapFixture.players[0]?.id ?? 'player-local',
    players: 'players' in fixture ? fixture.players : mapFixture.players,
    mergedMap,
    racePositions: {},
    message: mergedMap ? '레이스 준비 완료' : '레이스 맵을 찾을 수 없습니다.',
  }
}

function coerceResultsFixture(
  fixture: GameScreenFixture,
  raceFixture: RaceFixture,
): ResultsFixture {
  if (fixture.screenId === 'F_RESULTS') {
    return fixture
  }

  return {
    id: 'derived-results',
    screenId: 'F_RESULTS',
    title: '결과',
    description: 'route state에서 파생한 결과 상태입니다.',
    state: 'winner',
    viewport: fixture.viewport,
    roomId: fixture.roomId,
    players: raceFixture.players,
    currentUserId: raceFixture.currentUserId,
    stale: false,
  }
}

function createEmptySegment(roomId: string): MapSegmentSnapshot {
  const createdAt = new Date(0).toISOString()

  return {
    id: 'empty-segment',
    roomId,
    creatorId: 'unknown',
    startPoint: { x: 1, y: 7 },
    endPoint: { x: 22, y: 7 },
    placements: [],
    assetRefs: [],
    segmentHash: 'empty-segment',
    isValidated: false,
    submittedAt: createdAt,
    validatedAt: null,
    clearTimeMs: null,
  }
}
