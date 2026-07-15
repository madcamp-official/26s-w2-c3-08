import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')
const coreSource = read('client/src/pages/game/gameControllerCore.ts')
const raceLineSweepSource = read('client/src/game/raceLineSweep.ts')
const raceLastDanceMarkersSource = read('client/src/game/raceLastDanceMarkers.ts')
const core = await importTypeScriptModule(coreSource)
const raceLineSweep = await importTypeScriptModule(raceLineSweepSource)
const raceLastDanceMarkers = await importTypeScriptModule(raceLastDanceMarkersSource)

async function testBootSnapshotRoutesToServerPhase({
  bootGamePhaseController,
  createInitialGamePhaseControllerState,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    routeState: { kind: 'validation', roomId: 'room-flow', segmentId: 'segment-flow' },
    roomSnapshot: {
      roomId: 'room-flow',
      phase: 'building',
      phaseEndsAt: '2026-07-14T00:05:00.000Z',
      players: [
        {
          userId: 'user-a',
          nickname: '릴레이러',
          isHost: true,
          isReady: false,
        },
      ],
    },
    realtimeConnectResult: {
      ok: false,
      error: {
        kind: 'server_unavailable',
        message: 'Socket.IO dependency missing',
        retryable: false,
      },
    },
  })

  const result = await bootGamePhaseController(runtime)

  assert.equal(result.reason, 'snapshot_only')
  assert.equal(runtime.calls.getRoomSnapshot, 1)
  assert.deepEqual(runtime.routeChanges.at(-1), ['map-build', 'room-flow'])
  assert.equal(runtime.state.players[0].id, 'user-a')
  assert.equal(runtime.state.players[0].isReady, false)
  result.dispose()
}

async function testMapBuildToResultsFlow({
  createInitialGamePhaseControllerState,
  submitGameMapBuild,
  recordGameValidation,
  mergeGameRoomMap,
  finishGameRace,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    routeState: { kind: 'mapBuild', roomId: 'room-flow' },
  })

  runtime.state.session = session
  runtime.state.currentUserId = session.id

  const submitResult = await submitGameMapBuild(runtime)

  assert.equal(submitResult.ok, true)
  assert.equal(runtime.state.mapBuildState, 'submitComplete')
  assert.deepEqual(runtime.realtime.submittedSegments, [
    { roomId: 'room-flow', userId: 'user-a', segmentId: 'segment-flow' },
  ])
  assert.deepEqual(runtime.routeChanges.at(-1), ['validation', 'room-flow', 'segment-flow'])

  const validationResult = await recordGameValidation(runtime, true)

  assert.equal(validationResult.ok, true)
  assert.equal(runtime.state.validationState, 'cleared')
  assert.deepEqual(runtime.routeChanges.at(-1), ['merging', 'room-flow'])

  const mergeResult = await mergeGameRoomMap(runtime)

  assert.equal(mergeResult.ok, true)
  assert.equal(runtime.state.mergedMapId, 'merged-flow')
  assert.deepEqual(runtime.routeChanges.at(-1), ['race', 'room-flow', 'merged-flow'])

  runtime.state.routeKind = 'race'
  runtime.roomPort.finishRaceResult = createRaceResult('racing')

  const waitingResult = await finishGameRace(runtime)

  assert.equal(waitingResult.ok, true)
  assert.equal(runtime.state.raceState, 'playerFinished')
  assert.deepEqual(runtime.routeChanges.at(-1), ['race', 'room-flow', 'merged-flow'])

  runtime.roomPort.finishRaceResult = createRaceResult('finished')

  const finishedResult = await finishGameRace(runtime)

  assert.equal(finishedResult.ok, true)
  assert.equal(runtime.state.raceState, 'finish')
  assert.deepEqual(runtime.routeChanges.at(-1), ['results', 'room-flow'])
}

async function testValidationFailureCanOverrideClearedState({
  createInitialGamePhaseControllerState,
  recordGameValidation,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    routeState: { kind: 'validation', roomId: 'room-flow', segmentId: 'segment-flow' },
  })

  runtime.state.session = session
  runtime.state.currentUserId = session.id
  runtime.state.validationState = 'cleared'
  runtime.state.currentSegment = {
    ...segment,
    isValidated: true,
    validatedAt: '2026-07-14T00:02:00.000Z',
    clearTimeMs: 61_400,
  }

  const result = await recordGameValidation(runtime, false)

  assert.equal(result.ok, true)
  assert.equal(runtime.state.validationState, 'failedRecorded')
  assert.equal(runtime.calls.validateMapSegment, 1)
  assert.equal(runtime.calls.validationPayloads[0].cleared, false)
  assert.deepEqual(runtime.realtime.validationResults.at(-1), {
    roomId: 'room-flow',
    userId: 'user-a',
    cleared: false,
    segmentHash: 'hash-flow',
    clearTimeMs: 0,
  })
}

async function testServerRaceRankIsPreserved({
  createInitialGamePhaseControllerState,
  loadGameRaceResults,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    routeState: { kind: 'results', roomId: 'room-flow' },
  })

  runtime.state.session = session
  runtime.roomPort.getRaceResults = async () => ({
    ok: true,
    value: {
      roomId: 'room-flow',
      roomPhase: 'finished',
      players: [
        {
          userId: 'user-a',
          nickname: '릴레이러',
          isHost: true,
          validationCleared: true,
          raceProgress: 100,
          raceFinishedAtMs: 1_000,
          raceDistanceToGoal: 0,
          rank: 2,
        },
        {
          userId: 'user-b',
          nickname: '게스트',
          isHost: false,
          validationCleared: true,
          raceProgress: 100,
          raceFinishedAtMs: 1_500,
          raceDistanceToGoal: 0,
          rank: 1,
        },
      ],
    },
  })

  const result = await loadGameRaceResults(runtime)

  assert.equal(result.ok, true)
  assert.deepEqual(
    runtime.state.players.map((player) => [player.id, player.raceRank]),
    [
      ['user-a', 2],
      ['user-b', 1],
    ],
  )
}

async function testRealtimeRaceTimerSignals({
  bootGamePhaseController,
  createInitialGamePhaseControllerState,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    routeState: { kind: 'race', roomId: 'room-flow', mergedMapId: 'merged-flow' },
    roomSnapshot: {
      roomId: 'room-flow',
      phase: 'racing',
      phaseEndsAt: new Date(Date.now() + 80_000).toISOString(),
      players: [],
    },
  })

  const bootResult = await bootGamePhaseController(runtime)

  assert.equal(bootResult.reason, 'connected')
  assert.ok(runtime.roomHandlers)

  runtime.roomHandlers.onPhaseChanged({
    roomId: 'room-flow',
    phase: 'racing',
    phaseEndsAt: new Date(Date.now() + 30_000).toISOString(),
    isOvertime: true,
  })

  assert.equal(runtime.state.raceState, 'overtime')
  assert.match(runtime.state.message, /라스트댄스/)

  runtime.roomHandlers.onPhaseChanged({
    roomId: 'room-flow',
    phase: 'racing',
    phaseEndsAt: new Date(Date.now() + 10_000).toISOString(),
    isFinishCountdown: true,
  })

  assert.equal(runtime.state.raceState, 'playerFinished')
  assert.match(runtime.state.message, /10초/)

  runtime.state.remainingMs = 10_000
  runtime.state.raceElapsedSeconds = 0
  runtime.roomHandlers.onTimerTick({
    roomId: 'room-flow',
    phase: 'racing',
    remainingMs: 9_000,
  })
  runtime.roomHandlers.onTimerTick({
    roomId: 'room-flow',
    phase: 'racing',
    remainingMs: 8_000,
  })

  assert.equal(runtime.state.raceElapsedSeconds, 2)

  bootResult.dispose()
}

async function testRealtimeResultsFinalRoutesAndIgnoresLateRaceCountdown({
  bootGamePhaseController,
  createInitialGamePhaseControllerState,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    routeState: { kind: 'race', roomId: 'room-flow', mergedMapId: 'merged-flow' },
    roomSnapshot: {
      roomId: 'room-flow',
      phase: 'racing',
      phaseEndsAt: new Date(Date.now() + 80_000).toISOString(),
      players: [],
    },
  })

  const bootResult = await bootGamePhaseController(runtime)

  assert.equal(bootResult.reason, 'connected')
  assert.ok(runtime.roomHandlers)

  runtime.roomHandlers.onResultsFinal(createRaceResult('finished'))

  assert.equal(runtime.state.raceState, 'finish')
  assert.equal(runtime.state.players[0].raceRank, 1)
  assert.deepEqual(runtime.routeChanges.at(-1), ['results', 'room-flow'])

  runtime.roomHandlers.onPhaseChanged({
    roomId: 'room-flow',
    phase: 'racing',
    phaseEndsAt: new Date(Date.now() + 10_000).toISOString(),
    isFinishCountdown: true,
  })

  assert.equal(runtime.state.raceState, 'finish')
  assert.deepEqual(runtime.routeChanges.at(-1), ['results', 'room-flow'])

  bootResult.dispose()
}

async function testRealtimeMergingPhaseTriggersHostMergeOnce({
  bootGamePhaseController,
  createInitialGamePhaseControllerState,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    routeState: { kind: 'validation', roomId: 'room-flow', segmentId: 'segment-flow' },
    roomSnapshot: {
      roomId: 'room-flow',
      phase: 'validating',
      phaseEndsAt: new Date(Date.now() + 80_000).toISOString(),
      players: [
        {
          userId: 'user-a',
          nickname: '릴레이러',
          isHost: true,
          isReady: false,
        },
        {
          userId: 'user-b',
          nickname: '게스트',
          isHost: false,
          isReady: false,
        },
      ],
    },
  })

  const bootResult = await bootGamePhaseController(runtime)

  assert.equal(bootResult.reason, 'connected')
  assert.ok(runtime.roomHandlers)

  runtime.roomHandlers.onPhaseChanged({
    roomId: 'room-flow',
    phase: 'merging',
    phaseEndsAt: new Date(Date.now() + 30_000).toISOString(),
  })
  runtime.roomHandlers.onPhaseChanged({
    roomId: 'room-flow',
    phase: 'merging',
    phaseEndsAt: new Date(Date.now() + 30_000).toISOString(),
  })

  await flushMicrotasks()

  assert.equal(runtime.calls.mergeRoomMap, 1)
  assert.deepEqual(runtime.routeChanges.at(-1), ['race', 'room-flow', 'merged-flow'])

  bootResult.dispose()
}

async function testRealtimeMapMergedHydratesFullMergedMap({
  bootGamePhaseController,
  createInitialGamePhaseControllerState,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    routeState: { kind: 'merging', roomId: 'room-flow' },
    roomSnapshot: {
      roomId: 'room-flow',
      phase: 'merging',
      phaseEndsAt: new Date(Date.now() + 20_000).toISOString(),
      players: [
        {
          userId: 'user-a',
          nickname: '릴레이러',
          isHost: false,
          isReady: false,
        },
      ],
    },
  })

  const bootResult = await bootGamePhaseController(runtime)

  assert.equal(bootResult.reason, 'connected')
  assert.ok(runtime.roomHandlers)
  assert.equal(runtime.state.mergedMap, null)

  runtime.roomHandlers.onMapMerged({
    id: 'merged-flow',
    roomId: 'room-flow',
    usedFallback: false,
    createdAt: '2026-07-14T00:04:00.000Z',
  })

  await waitUntil(() => runtime.calls.getMergedMap === 1 && runtime.state.mergedMap?.id === 'merged-flow')

  assert.equal(runtime.state.mergedMapId, 'merged-flow')
  assert.equal(runtime.state.message, '레이스 맵을 불러왔어요.')

  bootResult.dispose()
}

async function testRealtimeRacingPhaseHydratesMissingMergedMap({
  bootGamePhaseController,
  createInitialGamePhaseControllerState,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    routeState: { kind: 'validation', roomId: 'room-flow', segmentId: 'segment-flow' },
    roomSnapshot: {
      roomId: 'room-flow',
      phase: 'validating',
      phaseEndsAt: new Date(Date.now() + 80_000).toISOString(),
      players: [
        {
          userId: 'user-a',
          nickname: '릴레이러',
          isHost: false,
          isReady: false,
        },
      ],
    },
  })

  const bootResult = await bootGamePhaseController(runtime)

  assert.equal(bootResult.reason, 'connected')
  assert.ok(runtime.roomHandlers)
  assert.equal(runtime.state.mergedMap, null)

  runtime.roomHandlers.onPhaseChanged({
    roomId: 'room-flow',
    phase: 'racing',
    phaseEndsAt: new Date(Date.now() + 120_000).toISOString(),
  })

  await waitUntil(() => runtime.calls.getMergedMap === 1 && runtime.state.mergedMap?.id === 'merged-flow')

  assert.deepEqual(runtime.routeChanges.at(-1), ['race', 'room-flow', undefined])
  assert.equal(runtime.state.mergedMapId, 'merged-flow')

  bootResult.dispose()
}

async function testRemoteFirstFinisherPollsFinalResults({
  createInitialGamePhaseControllerState,
  finishGameRace,
}) {
  const runtime = createRuntime(createInitialGamePhaseControllerState, {
    dataMode: 'remote',
    routeState: { kind: 'race', roomId: 'room-flow', mergedMapId: 'merged-flow' },
  })

  runtime.state.session = session
  runtime.state.currentUserId = session.id
  runtime.roomPort.finishRaceResult = createRaceResult('racing')
  runtime.roomPort.getRaceResults = async () => {
    runtime.calls.getRaceResults += 1

    return runtime.calls.getRaceResults < 2
      ? {
          ok: false,
          error: {
            kind: 'not_found',
            message: '아직 레이스 결과가 없어요.',
            retryable: true,
          },
        }
      : { ok: true, value: createRaceResult('finished') }
  }

  const finishResult = await finishGameRace(runtime)

  assert.equal(finishResult.ok, true)
  assert.equal(runtime.state.raceState, 'playerFinished')

  await waitUntil(() => runtime.routeChanges.some((change) => change[0] === 'results'))

  assert.equal(runtime.state.raceState, 'finish')
  assert.ok(runtime.calls.getRaceResults >= 2)
  assert.deepEqual(runtime.routeChanges.at(-1), ['results', 'room-flow'])
}

function testRaceLineSweepRules({
  getDestroyedRaceSegmentIds,
  getRaceLineGroundSpans,
  getRaceLineSweepStep,
}) {
  const secondSegment = {
    ...segment,
    id: 'segment-second',
    creatorId: 'user-b',
  }
  const twoLineMap = {
    ...mergedMap,
    globalEnd: { x: 46, y: 7 },
    placements: [
      ...segment.assetRefs.map((assetRef) => ({
        ...assetRef,
        sourceSegmentId: segment.id,
      })),
      ...secondSegment.assetRefs.map((assetRef) => ({
        ...assetRef,
        sourceSegmentId: secondSegment.id,
        x: assetRef.x + 24,
      })),
    ],
    segments: [
      { ...segment, isValidated: true },
      { ...secondSegment, isValidated: true },
    ],
  }

  assert.equal(getRaceLineSweepStep(twoLineMap, 49), 0)
  assert.deepEqual([...getDestroyedRaceSegmentIds(twoLineMap, 49)], [])
  assert.equal(getRaceLineSweepStep(twoLineMap, 50), 1)
  assert.deepEqual([...getDestroyedRaceSegmentIds(twoLineMap, 50)], ['segment-flow'])
  assert.equal(getRaceLineSweepStep(twoLineMap, 100), 2)
  assert.deepEqual([...getDestroyedRaceSegmentIds(twoLineMap, 100)], [
    'segment-flow',
    'segment-second',
  ])

  const spans = getRaceLineGroundSpans(twoLineMap, 100)

  assert.deepEqual(spans.map((span) => span.segmentId), ['segment-flow', 'segment-second'])
  assert.deepEqual(spans[0].start, { x: 1, y: 7 })
  assert.deepEqual(spans[0].end, { x: 22, y: 7 })
  assert.deepEqual(spans[1].start, { x: 25, y: 7 })
  assert.deepEqual(spans[1].end, { x: 46, y: 7 })
}

function testLastDanceMarkers({ getLastDanceTopMarkers }) {
  const markers = getLastDanceTopMarkers([
    { playerId: 'slow', nickname: '느림', progress: 20, x: 20, order: 0 },
    { playerId: 'tie-a', nickname: '동점A', progress: 80, x: 80, order: 1 },
    { playerId: 'leader', nickname: '선두', progress: 95, x: 95, order: 2 },
    { playerId: 'tie-b', nickname: '동점B', progress: 80, x: 82, order: 3 },
  ])

  assert.deepEqual(markers.map((marker) => marker.playerId), ['leader', 'tie-a', 'tie-b'])
  assert.deepEqual(markers.map((marker) => marker.medal), ['gold', 'silver', 'bronze'])
  assert.deepEqual(markers.map((marker) => marker.label), ['금', '은', '동'])
  assert.equal(markers[0].rank, 1)
  assert.equal(markers[1].rank, 2)
  assert.equal(markers[2].rank, 3)
}

const session = {
  id: 'user-a',
  nickname: '릴레이러',
  token: 'token-a',
}

const platformAsset = {
  id: 'asset-platform',
  creatorId: null,
  isSystem: true,
  category: 'platform',
  name: '발판',
  description: '',
  attrs: {},
  colliderType: 'rect',
  widthCells: 2,
  heightCells: 1,
  sourceImageUrl: '',
  remixOfId: null,
  status: 'ready',
  isPublic: true,
  createdAt: '2026-07-14T00:00:00.000Z',
  sprites: [],
}

const segment = {
  id: 'segment-flow',
  roomId: 'room-flow',
  creatorId: 'user-a',
  startPoint: { x: 1, y: 7 },
  endPoint: { x: 22, y: 7 },
  placements: [
    {
      id: 'placement-platform',
      x: 4,
      y: 7,
      asset: platformAsset,
    },
  ],
  assetRefs: [
    {
      assetId: platformAsset.id,
      assetCategory: platformAsset.category,
      assetAttrs: platformAsset.attrs,
      colliderType: platformAsset.colliderType,
      x: 4,
      y: 7,
      widthCells: 2,
      heightCells: 1,
      rotation: 0,
    },
  ],
  segmentHash: 'hash-flow',
  isValidated: false,
  submittedAt: '2026-07-14T00:01:00.000Z',
  validatedAt: null,
  clearTimeMs: null,
}

const mergedMap = {
  id: 'merged-flow',
  roomId: 'room-flow',
  globalStart: segment.startPoint,
  globalEnd: segment.endPoint,
  placements: segment.assetRefs.map((assetRef) => ({
    ...assetRef,
    sourceSegmentId: segment.id,
  })),
  segments: [{ ...segment, isValidated: true }],
  usedFallback: false,
  createdAt: '2026-07-14T00:02:00.000Z',
}

function createMapBuildFixture() {
  return {
    id: 'flow-map-build',
    screenId: 'S4_MAP_BUILD',
    title: '맵 제작',
    description: 'flow test',
    state: 'editing',
    viewport: '1280x720',
    roomId: 'room-flow',
    remainingMs: null,
    budgetUsed: 1,
    budgetLimit: 24,
    assets: [platformAsset],
    placements: segment.placements,
    selectedAssetId: platformAsset.id,
    selectedPlacementId: '',
    tool: 'place',
    startPoint: segment.startPoint,
    endPoint: segment.endPoint,
    isLocked: false,
    message: 'flow test',
    timeVoteText: '시간 투표 가능',
    players: [
      {
        id: 'user-a',
        nickname: '릴레이러',
        isHost: true,
        isReady: false,
        validationCleared: false,
        raceProgress: 0,
        raceFinishedAtMs: null,
        raceDistanceToGoal: 100,
      },
      {
        id: 'user-b',
        nickname: '게스트',
        isHost: false,
        isReady: false,
        validationCleared: false,
        raceProgress: 0,
        raceFinishedAtMs: null,
        raceDistanceToGoal: 100,
      },
    ],
    testSegment: segment,
  }
}

function createRuntime(createInitialGamePhaseControllerState, options = {}) {
  const routeState = options.routeState ?? { kind: 'mapBuild', roomId: 'room-flow' }
  const fixture = createMapBuildFixture()
  const runtime = {
    dataMode: options.dataMode ?? 'mock',
    state: createInitialGamePhaseControllerState(routeState, fixture),
    calls: {
      getRoomSnapshot: 0,
      saveMapSegment: 0,
      validateMapSegment: 0,
      validationPayloads: [],
      mergeRoomMap: 0,
      getMergedMap: 0,
      finishRace: 0,
      getRaceResults: 0,
    },
    routeChanges: [],
    realtime: {
      submittedSegments: [],
      readyMarks: [],
      validationResults: [],
      raceFinishes: [],
    },
    sessionStoragePort: {
      loadSession() {
        return options.session ?? session
      },
      saveSession() {
        return undefined
      },
      clearSession() {
        return undefined
      },
    },
    roomPort: {
      finishRaceResult: createRaceResult('racing'),
      async getRoomSnapshot() {
        runtime.calls.getRoomSnapshot += 1
        return {
          ok: true,
          value: options.roomSnapshot ?? {
            roomId: 'room-flow',
            phase: 'building',
            phaseEndsAt: null,
            players: [
              {
                userId: 'user-a',
                nickname: '릴레이러',
                isHost: true,
                isReady: false,
              },
            ],
          },
        }
      },
      async saveMapSegment() {
        runtime.calls.saveMapSegment += 1
        return {
          ok: true,
          value: {
            ...segment,
            roomPhase: 'validating',
          },
        }
      },
      async getMapSegment() {
        return { ok: true, value: segment }
      },
      async validateMapSegment(_session, payload) {
        runtime.calls.validateMapSegment += 1
        runtime.calls.validationPayloads.push(payload)
        return {
          ok: true,
          value: {
            ...segment,
            isValidated: payload.cleared,
            validatedAt: '2026-07-14T00:02:00.000Z',
            clearTimeMs: payload.clearTimeMs,
            roomPhase: 'merging',
          },
        }
      },
      async mergeRoomMap() {
        runtime.calls.mergeRoomMap += 1
        return { ok: true, value: mergedMap }
      },
      async getMergedMap() {
        runtime.calls.getMergedMap += 1
        return { ok: true, value: mergedMap }
      },
      async saveRaceProgress() {
        return { ok: true, value: createRaceResult('racing') }
      },
      async finishRace() {
        runtime.calls.finishRace += 1
        return { ok: true, value: runtime.roomPort.finishRaceResult }
      },
      async getRaceResults() {
        runtime.calls.getRaceResults += 1
        return { ok: true, value: createRaceResult('finished') }
      },
    },
    roomRealtime: {
      getStatus() {
        return 'offline'
      },
      async connect(_session, handlers) {
        runtime.roomHandlers = handlers
        return options.realtimeConnectResult ?? { ok: true, value: undefined }
      },
      disconnect() {
        runtime.disconnected = true
      },
      joinRoom() {
        return undefined
      },
      leaveRoom() {
        return undefined
      },
      setReady() {
        return undefined
      },
      startRoom() {
        return undefined
      },
      markPhaseReady(payload) {
        runtime.realtime.readyMarks.push(payload)
      },
      requestTimeVote() {
        return undefined
      },
      submitSegment(payload) {
        runtime.realtime.submittedSegments.push(payload)
      },
      publishValidationResult(payload) {
        runtime.realtime.validationResults.push(payload)
      },
    },
    gameRealtime: {
      getStatus() {
        return 'offline'
      },
      sendRacePosition() {
        return undefined
      },
      finishRace(payload) {
        runtime.realtime.raceFinishes.push(payload)
      },
      subscribe() {
        return () => {
          runtime.unsubscribed = true
        }
      },
    },
    routePort: {
      navigateLogin: () => runtime.routeChanges.push(['login']),
      navigateLobby: () => runtime.routeChanges.push(['lobby']),
      navigateRoom: (roomId) => runtime.routeChanges.push(['room', roomId]),
      navigateMapBuild: (roomId) => runtime.routeChanges.push(['map-build', roomId]),
      navigateValidation: (roomId, segmentId) => runtime.routeChanges.push(['validation', roomId, segmentId]),
      navigateMerging: (roomId) => runtime.routeChanges.push(['merging', roomId]),
      navigateRace: (roomId, mergedMapId) => runtime.routeChanges.push(['race', roomId, mergedMapId]),
      navigateResults: (roomId) => runtime.routeChanges.push(['results', roomId]),
    },
    getState: () => runtime.state,
    setState: (updater) => {
      runtime.state = updater(runtime.state)
    },
  }

  return runtime
}

function createRaceResult(roomPhase) {
  return {
    roomId: 'room-flow',
    roomPhase,
    players: [
      {
        userId: 'user-a',
        nickname: '릴레이러',
        isHost: true,
        validationCleared: true,
        raceProgress: 100,
        raceFinishedAtMs: 1_000,
        raceDistanceToGoal: 0,
        rank: 1,
      },
      {
        userId: 'user-b',
        nickname: '게스트',
        isHost: false,
        validationCleared: true,
        raceProgress: roomPhase === 'finished' ? 100 : 42,
        raceFinishedAtMs: roomPhase === 'finished' ? 1_500 : null,
        raceDistanceToGoal: roomPhase === 'finished' ? 0 : 58,
        rank: 2,
      },
    ],
  }
}

await testBootSnapshotRoutesToServerPhase(core)
await testMapBuildToResultsFlow(core)
await testValidationFailureCanOverrideClearedState(core)
await testServerRaceRankIsPreserved(core)
await testRealtimeRaceTimerSignals(core)
await testRealtimeResultsFinalRoutesAndIgnoresLateRaceCountdown(core)
await testRealtimeMergingPhaseTriggersHostMergeOnce(core)
await testRealtimeMapMergedHydratesFullMergedMap(core)
await testRealtimeRacingPhaseHydratesMissingMergedMap(core)
await testRemoteFirstFinisherPollsFinalResults(core)
testRaceLineSweepRules(raceLineSweep)
testLastDanceMarkers(raceLastDanceMarkers)

console.log('game controller flow self-test passed')

async function importTypeScriptModule(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  }).outputText
  const encoded = Buffer.from(output, 'utf8').toString('base64')

  return import(`data:text/javascript;base64,${encoded}`)
}

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function waitUntil(predicate, timeoutMs = 1_500) {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve()
        return
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('condition was not met before timeout'))
        return
      }

      setTimeout(tick, 25)
    }

    tick()
  })
}
