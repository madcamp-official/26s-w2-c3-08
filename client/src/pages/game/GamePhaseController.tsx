import { useMemo, useState } from 'react'

import { setPrototypeRoute, type ContractRouteModel } from '../../app/navigation/prototypeRouter'
import type { GameRealtime, RoomRealtime } from '../../domain/ports'
import { createMockGameRoomPort } from '../../infrastructure/game/mockGameRoomPort'
import { createRemoteGameRoomPort } from '../../infrastructure/game/remoteGameRoomPort'
import {
  MapEditorPhaserBridge,
  PlaytestPhaserBridge,
  RacePhaserBridge,
  type EditorTool,
} from '../../infrastructure/phaser/phaserCanvasBridges'
import { resolveV2ModeConfig, type V2ModeConfig } from '../../infrastructure/config/modeConfig'
import { createV2RealtimeAdapters } from '../../infrastructure/realtime/realtimeAdapters'
import { createBrowserSessionStoragePort } from '../../infrastructure/session/browserSessionStoragePort'
import {
  type GameScreenFixture,
  type MapBuildFixture,
  type MergingFixture,
  type RaceFixture,
  type ResultsFixture,
  type ValidationFixture,
} from '../../fixtures/game/gameFixtures'
import {
  MapBuildScreen,
  MergingScreen,
  RaceScreen,
  ResultsScreen,
  ValidationScreen,
} from './GameScreens'
import type { LoginDataMode, StoragePort } from '../login/loginControllerCore'
import type { GamePhaseControllerState, GameRoomPort, GameRoutePort } from './gameControllerCore'
import type { PhaserBridgeLifecycleEvent } from './PhaserBridge'
import { useGamePhaseController, type GamePhaseControllerActions } from './useGamePhaseController'

export type GameRouteState = Extract<
  ContractRouteModel,
  { kind: 'mapBuild' | 'validation' | 'merging' | 'race' | 'results' }
>

export interface GamePhaseControllerProps {
  routeState: GameRouteState
  fixtureId?: string
  dependencies?: Partial<GamePhaseControllerDependencies>
}

export interface GamePhaseControllerDependencies {
  dataMode: LoginDataMode
  sessionStoragePort: StoragePort
  roomPort: GameRoomPort
  roomRealtime: RoomRealtime
  gameRealtime: GameRealtime
  routePort: GameRoutePort
}

export function GamePhaseController({ routeState, fixtureId, dependencies }: GamePhaseControllerProps) {
  const modeConfig = useMemo(() => resolveV2ModeConfig(), [])
  const defaultDependencies = useMemo(
    () => createGamePhaseControllerDependencies(modeConfig),
    [modeConfig],
  )
  const resolvedDependencies = useMemo<GamePhaseControllerDependencies>(
    () => ({
      ...defaultDependencies,
      ...dependencies,
    }),
    [defaultDependencies, dependencies],
  )
  const controller = useGamePhaseController({
    routeState,
    fixtureId,
    ...resolvedDependencies,
  })

  return (
    <div
      data-v2-component="game-phase-controller"
      data-v2-data-mode={resolvedDependencies.dataMode}
      data-v2-realtime-mode={modeConfig.realtimeMode}
      data-v2-game-route={routeState.kind}
    >
      <GameControlledScreen
        state={controller.state}
        actions={controller.actions}
        onLifecycleEvent={controller.handleLifecycleEvent}
      />
    </div>
  )
}

export function createGamePhaseControllerDependencies(
  modeConfig: V2ModeConfig = resolveV2ModeConfig(),
): GamePhaseControllerDependencies {
  const realtimeAdapters = createV2RealtimeAdapters(modeConfig)

  return {
    dataMode: modeConfig.dataMode,
    sessionStoragePort: createBrowserSessionStoragePort(),
    roomPort: modeConfig.dataMode === 'mock' ? createMockGameRoomPort() : createRemoteGameRoomPort(),
    roomRealtime: realtimeAdapters.roomRealtime,
    gameRealtime: realtimeAdapters.gameRealtime,
    routePort: {
      navigateLogin: () => setPrototypeRoute('login'),
      navigateLobby: () => setPrototypeRoute('lobby'),
      navigateRoom: (roomId) => setPrototypeRoute('room', { roomId }),
      navigateMapBuild: (roomId) => setPrototypeRoute('map-build', { roomId }),
      navigateValidation: (roomId, segmentId) =>
        setPrototypeRoute('validation', segmentId ? { roomId, segmentId } : { roomId }),
      navigateMerging: (roomId) => setPrototypeRoute('merging', { roomId }),
      navigateRace: (roomId, mergedMapId) =>
        setPrototypeRoute('race', mergedMapId ? { roomId, mergedMapId } : { roomId }),
      navigateResults: (roomId) => setPrototypeRoute('results', { roomId }),
    },
  }
}

function GameControlledScreen({
  state,
  actions,
  onLifecycleEvent,
}: {
  state: GamePhaseControllerState
  actions: GamePhaseControllerActions
  onLifecycleEvent: (event: PhaserBridgeLifecycleEvent) => void
}) {
  const selectedAsset = state.assets.find((asset) => asset.id === state.selectedAssetId) ?? null
  const routeKey = `${state.routeKind}:${state.roomId}:${state.currentSegment?.id ?? 'pending'}`

  if (state.routeKind === 'validation') {
    return (
      <ValidationScreen
        state={state.validationState}
        roomId={state.roomId}
        remainingMs={state.remainingMs}
        players={state.players}
        message={state.message}
        canvas={
          <PlaytestPhaserBridge
            bridgeId={`validation:${state.roomId}`}
            routeKey={routeKey}
            isCleared={state.validationState === 'cleared'}
            segment={state.currentSegment}
            resetSignal={state.resetSignal}
            onClear={actions.recordValidationCleared}
            onLifecycleEvent={onLifecycleEvent}
          />
        }
        onGoRoom={actions.goRoom}
        onLeaveRoom={actions.leaveRoom}
        onReset={actions.resetValidation}
        onRecordFailure={actions.recordValidationFailure}
      />
    )
  }

  if (state.routeKind === 'merging') {
    return (
      <MergingScreen
        state={state.mergingState}
        roomId={state.roomId}
        progress={state.mergeProgress}
        validatedSegments={state.currentSegment?.isValidated ? 1 : 0}
        globalPlacements={state.mergedMap?.placements.length ?? state.placements.length}
        usedFallback={state.mergedMap?.usedFallback ?? false}
        message={state.message}
        onGoRoom={actions.goRoom}
        onLeaveRoom={actions.leaveRoom}
        onRetryMerge={actions.retryMerge}
      />
    )
  }

  if (state.routeKind === 'race') {
    return (
      <RaceScreen
        state={state.mergedMap ? state.raceState : 'missingMap'}
        roomId={state.roomId}
        remainingMs={state.remainingMs}
        players={state.players}
        currentUserId={state.currentUserId}
        message={state.message}
        canvas={
          <RacePhaserBridge
            bridgeId={`race:${state.roomId}`}
            routeKey={routeKey}
            players={state.players}
            currentUserId={state.currentUserId}
            mergedMap={state.mergedMap}
            racePositions={state.racePositions}
            isExtended={state.raceState === 'overtime'}
            elapsedSeconds={state.raceElapsedSeconds}
            onProgress={actions.publishRaceProgress}
            onFinish={actions.finishRace}
            onLifecycleEvent={onLifecycleEvent}
          />
        }
        onGoRoom={actions.goRoom}
        onLeaveRoom={actions.leaveRoom}
        onFinishRace={actions.finishRace}
        onShowResults={actions.showResults}
      />
    )
  }

  if (state.routeKind === 'results') {
    return (
      <ResultsScreen
        state={state.resultsState}
        roomId={state.roomId}
        players={state.players}
        currentUserId={state.currentUserId}
        stale={state.staleResults}
        onGoRoom={actions.goRoom}
        onLeaveRoom={actions.leaveRoom}
      />
    )
  }

  return (
    <MapBuildScreen
      state={state.mapBuildState}
      roomId={state.roomId}
      remainingMs={state.remainingMs}
      budgetUsed={state.budgetUsed}
      budgetLimit={state.budgetLimit}
      assets={state.assets}
      selectedAssetId={state.selectedAssetId}
      tool={state.tool}
      message={state.message}
      timeVoteText={state.timeVoteText}
      players={state.players}
      canvas={
        <MapEditorPhaserBridge
          bridgeId={`map-editor:${state.roomId}`}
          routeKey={routeKey}
          placements={state.placements}
          selectedAsset={selectedAsset}
          selectedPlacementId={state.selectedPlacementId}
          tool={state.tool}
          toolLabel={getToolLabel(state.tool)}
          canAffordSelectedAsset={state.budgetUsed < state.budgetLimit}
          isLocked={state.isLocked || state.mapBuildState === 'locked' || state.mapBuildState === 'submitComplete'}
          zoom={1}
          getEndpointLabel={(x, y) => getEndpointLabelFromState(state, x, y)}
          onToggleCell={actions.handleMapCell}
          onDropAsset={actions.dropMapAsset}
          onLifecycleEvent={onLifecycleEvent}
        />
      }
      buildTestCanvas={
        <PlaytestPhaserBridge
          bridgeId={`build-test:${state.roomId}`}
          routeKey={`${routeKey}:build-test`}
          isCleared={false}
          segment={state.currentSegment}
          resetSignal={state.resetSignal}
          onClear={actions.recordValidationCleared}
          onLifecycleEvent={onLifecycleEvent}
        />
      }
      onGoRoom={actions.goRoom}
      onLeaveRoom={actions.leaveRoom}
      onSelectAsset={actions.selectAsset}
      onSelectTool={actions.selectTool}
      onTimeVote={actions.requestTimeVote}
      onOpenBuildTest={actions.openBuildTest}
      onCloseBuildTest={actions.closeBuildTest}
      onSubmit={actions.submitMapBuild}
    />
  )
}

export function GameFixturePreview({
  fixture,
  roomId = fixture.roomId,
}: {
  fixture: GameScreenFixture
  roomId?: string
}) {
  switch (fixture.screenId) {
    case 'S4_MAP_BUILD':
      return <MapBuildFixtureScreen fixture={{ ...fixture, roomId }} />
    case 'D_VALIDATION':
      return <ValidationFixtureScreen fixture={{ ...fixture, roomId }} />
    case 'M_MERGING':
      return <MergingFixtureScreen fixture={{ ...fixture, roomId }} />
    case 'E_RACE':
      return <RaceFixtureScreen fixture={{ ...fixture, roomId }} />
    case 'F_RESULTS':
      return <ResultsFixtureScreen fixture={{ ...fixture, roomId }} />
  }
}

function MapBuildFixtureScreen({ fixture }: { fixture: MapBuildFixture }) {
  const [selectedAssetId, setSelectedAssetId] = useState(fixture.selectedAssetId)
  const [tool, setTool] = useState<EditorTool>(fixture.tool)
  const [state, setState] = useState(fixture.state)
  const [message, setMessage] = useState(fixture.message)
  const selectedAsset = fixture.assets.find((asset) => asset.id === selectedAssetId) ?? null
  const routeKey = `${fixture.screenId}:${fixture.roomId}:${fixture.id}`
  const handleLifecycleEvent = (event: PhaserBridgeLifecycleEvent) => {
    if (event.type === 'duplicate-prevented') {
      setMessage('이미 실행 중인 Phaser 캔버스가 있어 새 인스턴스를 만들지 않았어요.')
    }
  }

  return (
    <MapBuildScreen
      state={state}
      roomId={fixture.roomId}
      remainingMs={fixture.remainingMs}
      budgetUsed={fixture.budgetUsed}
      budgetLimit={fixture.budgetLimit}
      assets={fixture.assets}
      selectedAssetId={selectedAssetId}
      tool={tool}
      message={message}
      timeVoteText={fixture.timeVoteText}
      players={fixture.players}
      canvas={
        <MapEditorPhaserBridge
          bridgeId={`map-editor:${fixture.roomId}`}
          routeKey={routeKey}
          placements={fixture.placements}
          selectedAsset={selectedAsset}
          selectedPlacementId={fixture.selectedPlacementId}
          tool={tool}
          toolLabel={getToolLabel(tool)}
          canAffordSelectedAsset={fixture.budgetUsed < fixture.budgetLimit}
          isLocked={fixture.isLocked || state === 'locked' || state === 'submitComplete'}
          zoom={1}
          getEndpointLabel={(x, y) => getEndpointLabel(fixture, x, y)}
          onToggleCell={(x, y) => setMessage(`보드 ${x},${y} 선택 · Phaser input event`)}
          onDropAsset={(assetId, x, y) => setMessage(`${assetId} 드롭 · ${x},${y}`)}
          onLifecycleEvent={handleLifecycleEvent}
        />
      }
      buildTestCanvas={
        <PlaytestPhaserBridge
          bridgeId={`build-test:${fixture.roomId}`}
          routeKey={`${routeKey}:build-test`}
          isCleared={false}
          segment={fixture.testSegment}
          resetSignal={0}
          onClear={() => setMessage('테스트 성공')}
          onLifecycleEvent={handleLifecycleEvent}
        />
      }
      onGoRoom={() => setPrototypeRoute('room', { roomId: fixture.roomId })}
      onLeaveRoom={() => setPrototypeRoute('lobby')}
      onSelectAsset={(assetId) => {
        setSelectedAssetId(assetId)
        setMessage('에셋 선택 변경')
      }}
      onSelectTool={(nextTool) => {
        setTool(nextTool as EditorTool)
        setMessage(`${getToolLabel(nextTool)} 도구 선택`)
      }}
      onTimeVote={(deltaSeconds) => {
        setState('timeVotePending')
        setMessage(`${deltaSeconds > 0 ? '+' : ''}${deltaSeconds}초 시간 투표 요청`)
      }}
      onOpenBuildTest={() => setState('buildTest')}
      onCloseBuildTest={() => setState(fixture.state === 'buildTest' ? 'editing' : fixture.state)}
      onSubmit={() => {
        setState('submitComplete')
        setMessage('맵 잠김 · 저장된 스냅샷을 검증합니다.')
      }}
    />
  )
}

function ValidationFixtureScreen({ fixture }: { fixture: ValidationFixture }) {
  const [state, setState] = useState(fixture.state)
  const [isCleared, setCleared] = useState(fixture.isCleared)
  const [resetSignal, setResetSignal] = useState(fixture.resetSignal)
  const [message, setMessage] = useState(fixture.message)
  const routeKey = `${fixture.screenId}:${fixture.roomId}:${fixture.id}`

  return (
    <ValidationScreen
      state={state}
      roomId={fixture.roomId}
      remainingMs={fixture.remainingMs}
      players={fixture.players}
      message={message}
      canvas={
        <PlaytestPhaserBridge
          bridgeId={`validation:${fixture.roomId}`}
          routeKey={routeKey}
          isCleared={isCleared}
          segment={fixture.segment}
          resetSignal={resetSignal}
          onClear={() => {
            setCleared(true)
            setState('cleared')
            setMessage('검증 성공 기록 완료 · 다른 플레이어 대기')
          }}
        />
      }
      onGoRoom={() => setPrototypeRoute('room', { roomId: fixture.roomId })}
      onLeaveRoom={() => setPrototypeRoute('lobby')}
      onReset={() => {
        setCleared(false)
        setResetSignal((current) => current + 1)
        setMessage('처음부터 다시 시작합니다.')
      }}
      onRecordFailure={() => {
        setState('failedRecorded')
        setMessage('검증 실패 기록 완료 · 다른 플레이어 대기')
      }}
    />
  )
}

function MergingFixtureScreen({ fixture }: { fixture: MergingFixture }) {
  const [state, setState] = useState(fixture.state)
  const [message, setMessage] = useState(fixture.message)

  return (
    <MergingScreen
      state={state}
      roomId={fixture.roomId}
      progress={fixture.progress}
      validatedSegments={fixture.validatedSegments}
      globalPlacements={fixture.globalPlacements}
      usedFallback={fixture.usedFallback}
      message={message}
      onGoRoom={() => setPrototypeRoute('room', { roomId: fixture.roomId })}
      onLeaveRoom={() => setPrototypeRoute('lobby')}
      onRetryMerge={() => {
        setState('merging')
        setMessage('다시 병합을 요청했어요.')
      }}
    />
  )
}

function RaceFixtureScreen({ fixture }: { fixture: RaceFixture }) {
  const [message, setMessage] = useState(fixture.message)
  const routeKey = `${fixture.screenId}:${fixture.roomId}:${fixture.id}`

  return (
    <RaceScreen
      state={fixture.state}
      roomId={fixture.roomId}
      remainingMs={fixture.remainingMs}
      players={fixture.players}
      currentUserId={fixture.currentUserId}
      message={message}
      canvas={
        <RacePhaserBridge
          bridgeId={`race:${fixture.roomId}`}
          routeKey={routeKey}
          players={fixture.players}
          currentUserId={fixture.currentUserId}
          mergedMap={fixture.mergedMap}
          racePositions={fixture.racePositions}
          isExtended={fixture.isExtended}
          elapsedSeconds={fixture.elapsedSeconds}
          onProgress={(progressById) => {
            const localProgress = progressById[fixture.currentUserId]

            if (localProgress !== undefined) {
              setMessage(`내 진행률 ${Math.round(localProgress)}%`)
            }
          }}
          onFinish={() => setMessage('완주 기록을 받았어요.')}
        />
      }
      onGoRoom={() => setPrototypeRoute('room', { roomId: fixture.roomId })}
      onLeaveRoom={() => setPrototypeRoute('lobby')}
      onFinishRace={() => setMessage('완주 기록을 받았어요.')}
      onShowResults={() => setPrototypeRoute('results', { roomId: fixture.roomId })}
    />
  )
}

function ResultsFixtureScreen({ fixture }: { fixture: ResultsFixture }) {
  return (
    <ResultsScreen
      state={fixture.state}
      roomId={fixture.roomId}
      players={fixture.players}
      currentUserId={fixture.currentUserId}
      stale={fixture.stale}
      onGoRoom={() => setPrototypeRoute('room', { roomId: fixture.roomId })}
      onLeaveRoom={() => setPrototypeRoute('lobby')}
    />
  )
}

function getEndpointLabel(fixture: MapBuildFixture, x: number, y: number) {
  if (fixture.startPoint.x === x && fixture.startPoint.y === y) {
    return 'START'
  }

  if (fixture.endPoint.x === x && fixture.endPoint.y === y) {
    return 'GOAL'
  }

  return null
}

function getEndpointLabelFromState(state: GamePhaseControllerState, x: number, y: number) {
  if (state.startPoint.x === x && state.startPoint.y === y) {
    return 'START'
  }

  if (state.endPoint.x === x && state.endPoint.y === y) {
    return 'GOAL'
  }

  return null
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
