import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  bootGamePhaseController,
  closeBuildTest,
  createInitialGamePhaseControllerState,
  dropGameMapAsset,
  finishGameRace,
  handleGameMapCell,
  mergeGameRoomMap,
  openBuildTest,
  publishGameRaceProgress,
  recordGameValidation,
  requestGameTimeVote,
  resetGameValidation,
  selectGameAsset,
  selectGameTool,
  submitGameMapBuild,
  type GamePhaseControllerRuntime,
  type GamePhaseControllerState,
  type GameRouteState,
} from './gameControllerCore'
import { getGameScreenFixture } from '../../fixtures/game/gameFixtures'
import type { EditorTool } from '../../infrastructure/phaser/phaserCanvasBridges'
import type { RacePositionSnapshot } from '../../types/domain'

export interface UseGamePhaseControllerOptions
  extends Omit<GamePhaseControllerRuntime, 'getState' | 'setState'> {
  routeState: GameRouteState
  fixtureId?: string
}

export interface GamePhaseControllerActions {
  selectAsset(assetId: string): void
  selectTool(tool: string): void
  requestTimeVote(deltaSec: number): void
  handleMapCell(x: number, y: number): void
  dropMapAsset(assetId: string, x: number, y: number): void
  openBuildTest(): void
  closeBuildTest(): void
  submitMapBuild(): void
  resetValidation(): void
  recordValidationFailure(): void
  recordValidationCleared(): void
  retryMerge(): void
  showResults(): void
  goRoom(): void
  leaveRoom(): void
  publishRaceProgress(
    progressById: Record<string, number>,
    localPosition?: Omit<RacePositionSnapshot, 'userId'>,
  ): void
  finishRace(): void
}

export function useGamePhaseController({
  routeState,
  fixtureId,
  dataMode,
  sessionStoragePort,
  roomPort,
  roomRealtime,
  gameRealtime,
  routePort,
}: UseGamePhaseControllerOptions) {
  const fixture = useMemo(() => getGameScreenFixture(fixtureId), [fixtureId])
  const [state, setState] = useState<GamePhaseControllerState>(() =>
    createInitialGamePhaseControllerState(routeState, fixture),
  )
  const stateRef = useRef(state)

  const setControllerState = useCallback((updater: (state: GamePhaseControllerState) => GamePhaseControllerState) => {
    const nextState = updater(stateRef.current)

    stateRef.current = nextState
    setState(nextState)
  }, [])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const runtime = useMemo<GamePhaseControllerRuntime>(
    () => ({
      dataMode,
      sessionStoragePort,
      roomPort,
      roomRealtime,
      gameRealtime,
      routePort,
      getState: () => stateRef.current,
      setState: setControllerState,
    }),
    [dataMode, gameRealtime, roomPort, roomRealtime, routePort, sessionStoragePort, setControllerState],
  )

  useEffect(() => {
    setControllerState((current) => createRouteSyncedGameState(current, routeState, fixture))
  }, [fixture, routeState, setControllerState])

  useEffect(() => {
    let dispose: (() => void) | undefined
    let cancelled = false

    void bootGamePhaseController(runtime).then((result) => {
      if (!cancelled && 'dispose' in result) {
        dispose = result.dispose
      }
    })

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [fixtureId, routeState.kind, routeState.mergedMapId, routeState.roomId, routeState.segmentId, runtime])

  const actions = useMemo<GamePhaseControllerActions>(
    () => ({
      selectAsset: (assetId) => selectGameAsset(runtime, assetId),
      selectTool: (tool) => selectGameTool(runtime, tool as EditorTool),
      requestTimeVote: (deltaSec) => requestGameTimeVote(runtime, deltaSec),
      handleMapCell: (x, y) => handleGameMapCell(runtime, x, y),
      dropMapAsset: (assetId, x, y) => dropGameMapAsset(runtime, assetId, x, y),
      openBuildTest: () => openBuildTest(runtime),
      closeBuildTest: () => closeBuildTest(runtime),
      submitMapBuild: () => {
        void submitGameMapBuild(runtime)
      },
      resetValidation: () => resetGameValidation(runtime),
      recordValidationFailure: () => {
        void recordGameValidation(runtime, false)
      },
      recordValidationCleared: () => {
        void recordGameValidation(runtime, true)
      },
      retryMerge: () => {
        void mergeGameRoomMap(runtime)
      },
      showResults: () => routePort.navigateResults(runtime.getState().roomId),
      goRoom: () => routePort.navigateRoom(runtime.getState().roomId),
      leaveRoom: () => routePort.navigateLobby(),
      publishRaceProgress: (progressById, localPosition) =>
        publishGameRaceProgress(runtime, progressById, localPosition),
      finishRace: () => {
        void finishGameRace(runtime)
      },
    }),
    [routePort, runtime],
  )

  const handleLifecycleEvent = useCallback(
    (event: { type: string }) => {
      if (event.type === 'duplicate-prevented') {
        setControllerState((current) => ({
          ...current,
          message: '이미 실행 중인 Phaser 캔버스가 있어 새 인스턴스를 만들지 않았어요.',
        }))
      }
    },
    [setControllerState],
  )

  return {
    fixture,
    state,
    actions,
    handleLifecycleEvent,
  }
}

function createRouteSyncedGameState(
  current: GamePhaseControllerState,
  routeState: GameRouteState,
  fixture: Parameters<typeof createInitialGamePhaseControllerState>[1],
): GamePhaseControllerState {
  const nextState: GamePhaseControllerState = {
    ...createInitialGamePhaseControllerState(routeState, fixture),
    session: current.session,
    currentUserId: current.session?.id ?? current.currentUserId,
  }

  if (current.roomId !== routeState.roomId) {
    return nextState
  }

  const preservedSegment =
    current.currentSegment !== null &&
    (!routeState.segmentId || current.currentSegment.id === routeState.segmentId)
      ? current.currentSegment
      : null
  const preservedMergedMap =
    current.mergedMap !== null &&
    (!routeState.mergedMapId || current.mergedMap.id === routeState.mergedMapId)
      ? current.mergedMap
      : null

  if (preservedSegment && (routeState.kind === 'validation' || routeState.kind === 'merging')) {
    nextState.currentSegment = preservedSegment
    nextState.segmentId = preservedSegment.id
    nextState.players = current.players
    nextState.validationState =
      routeState.kind === 'validation' && preservedSegment.isValidated
        ? 'cleared'
        : nextState.validationState
  }

  if (preservedMergedMap && routeState.kind === 'race') {
    nextState.mergedMap = preservedMergedMap
    nextState.mergedMapId = preservedMergedMap.id
    nextState.players = current.players
    nextState.racePositions = current.racePositions
    nextState.raceElapsedSeconds = current.raceElapsedSeconds
    nextState.raceState = current.raceState === 'missingMap' ? 'normal' : current.raceState
    nextState.message = '서버에서 병합한 맵으로 레이스를 준비했어요.'
  }

  if (routeState.kind === 'results') {
    nextState.players = current.players.length > 0 ? current.players : nextState.players
    nextState.racePositions = current.racePositions
    nextState.staleResults = current.staleResults
  }

  return nextState
}
