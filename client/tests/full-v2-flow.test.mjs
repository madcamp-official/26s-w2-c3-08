import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')

const loginCoreSource = read('client/src/pages/login/loginControllerCore.ts')
const mainCoreSource = read('client/src/pages/main/mainControllerCore.ts')
const roomCoreSource = read('client/src/pages/room/roomControllerCore.ts')
const gameCoreSource = read('client/src/pages/game/gameControllerCore.ts')
const packageSource = read('client/package.json')

const loginCore = await importTypeScriptModule(loginCoreSource)
const mainCore = await importTypeScriptModule(mainCoreSource)
const roomCore = await importTypeScriptModule(roomCoreSource)
const gameCore = await importTypeScriptModule(gameCoreSource)

const session = {
  id: 'user-a',
  nickname: '릴레이러',
  token: 'token-a',
  avatarAssetId: null,
}

const guest = {
  userId: 'user-b',
  nickname: '게스트',
  isHost: false,
  isReady: true,
}

const createdRoom = {
  id: 'room-flow',
  name: '전체 흐름 테스트방',
  hostId: session.id,
  hostNickname: session.nickname,
  isPublic: true,
  players: 2,
  maxPlayers: 4,
  phase: 'lobby',
  elapsedSeconds: 0,
  phaseEndsAt: null,
}

const platformAsset = {
  id: 'asset-platform-flow',
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
  roomId: createdRoom.id,
  creatorId: session.id,
  startPoint: { x: 1, y: 7 },
  endPoint: { x: 22, y: 7 },
  placements: [
    {
      id: 'placement-platform-flow',
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
  roomId: createdRoom.id,
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

await testFullLoginToResultsControllerFlow()

assert.match(loginCoreSource, /submitLoginNickname/)
assert.match(mainCoreSource, /createMainScreenCallbacks/)
assert.match(roomCoreSource, /createLobbyRoom/)
assert.match(roomCoreSource, /startRoom/)
assert.match(gameCoreSource, /submitGameMapBuild/)
assert.match(gameCoreSource, /recordGameValidation/)
assert.match(gameCoreSource, /mergeGameRoomMap/)
assert.match(gameCoreSource, /finishGameRace/)
assert.match(packageSource, /flow:check/)

console.log('full v2 flow controller self-test passed')

async function testFullLoginToResultsControllerFlow() {
  const harness = createFlowHarness()

  const loginRuntime = createLoginRuntime(harness)
  const loginResult = await loginCore.submitLoginNickname(loginRuntime, '  릴레이러  ')

  assert.equal(loginResult.destination, 'main')
  assert.equal(loginResult.reason, 'success')
  assert.equal(harness.storedSession?.token, session.token)
  assert.deepEqual(harness.routeChanges.at(-1), ['main'])

  const mainRuntime = createMainRuntime(harness)
  const mainBootResult = await mainCore.bootMainController(mainRuntime)

  assert.equal(mainBootResult.destination, 'main')
  assert.equal(mainBootResult.reason, 'loaded')
  assert.equal(mainRuntime.state.nickname, session.nickname)

  mainCore.createMainScreenCallbacks(mainRuntime).onNavigateLobby()
  assert.deepEqual(harness.routeChanges.at(-1), ['lobby'])

  const roomRuntime = createRoomRuntime(harness)
  const createdResult = await roomCore.createLobbyRoom(roomRuntime)

  assert.equal(createdResult.ok, true)
  assert.equal(roomRuntime.calls.createRoom, 1)
  assert.equal(roomRuntime.calls.getRoomSnapshot, 1)
  assert.deepEqual(harness.realtime.roomJoins[0], {
    roomId: createdRoom.id,
    userId: session.id,
    nickname: session.nickname,
    isHost: true,
  })
  assert.deepEqual(harness.routeChanges.at(-1), ['room', createdRoom.id])

  const startResult = await roomCore.startRoom(roomRuntime)

  assert.equal(startResult.ok, true)
  assert.equal(roomRuntime.calls.startRoom, 1)
  assert.deepEqual(harness.realtime.roomStarts[0], {
    roomId: createdRoom.id,
    userId: session.id,
  })
  assert.deepEqual(harness.routeChanges.at(-1), ['map-build', createdRoom.id])

  const gameRuntime = createGameRuntime(harness)
  const bootGameResult = await gameCore.bootGamePhaseController(gameRuntime)

  assert.equal(bootGameResult.destination, 'mapBuild')
  assert.equal(bootGameResult.reason, 'connected')
  assert.equal(gameRuntime.calls.getRoomSnapshot, 1)
  assert.equal(gameRuntime.state.players.length, 2)

  const submitResult = await gameCore.submitGameMapBuild(gameRuntime)

  assert.equal(submitResult.ok, true)
  assert.equal(gameRuntime.calls.saveMapSegment, 1)
  assert.deepEqual(harness.realtime.submittedSegments[0], {
    roomId: createdRoom.id,
    userId: session.id,
    segmentId: segment.id,
  })
  assert.deepEqual(harness.routeChanges.at(-1), ['validation', createdRoom.id, segment.id])

  const validationResult = await gameCore.recordGameValidation(gameRuntime, true)

  assert.equal(validationResult.ok, true)
  assert.equal(gameRuntime.calls.validateMapSegment, 1)
  assert.deepEqual(harness.realtime.validationResults[0], {
    roomId: createdRoom.id,
    userId: session.id,
    cleared: true,
    segmentHash: segment.segmentHash,
    clearTimeMs: 61_400,
  })
  assert.deepEqual(harness.routeChanges.at(-1), ['merging', createdRoom.id])

  const mergeResult = await gameCore.mergeGameRoomMap(gameRuntime)

  assert.equal(mergeResult.ok, true)
  assert.equal(gameRuntime.calls.mergeRoomMap, 1)
  assert.equal(gameRuntime.state.mergedMapId, mergedMap.id)
  assert.deepEqual(harness.routeChanges.at(-1), ['race', createdRoom.id, mergedMap.id])

  gameRuntime.state = {
    ...gameRuntime.state,
    routeKind: 'race',
    mergedMap,
    mergedMapId: mergedMap.id,
  }

  const finishResult = await gameCore.finishGameRace(gameRuntime)

  assert.equal(finishResult.ok, true)
  assert.equal(gameRuntime.calls.finishRace, 1)
  assert.deepEqual(harness.realtime.raceFinishes.map(({ roomId, userId }) => [roomId, userId]), [
    [createdRoom.id, session.id],
  ])
  assert.deepEqual(harness.routeChanges.at(-1), ['results', createdRoom.id])
  assert.deepEqual(harness.routeChanges.map((route) => route[0]), [
    'main',
    'lobby',
    'room',
    'map-build',
    'validation',
    'merging',
    'race',
    'results',
  ])

  bootGameResult.dispose()
  assert.equal(harness.realtime.gameUnsubscribed, true)
  assert.equal(harness.realtime.gameRoomDisconnected, true)
}

function createFlowHarness() {
  return {
    storedSession: null,
    routeChanges: [],
    realtime: {
      roomJoins: [],
      roomStarts: [],
      gameRoomJoins: [],
      readyMarks: [],
      submittedSegments: [],
      validationResults: [],
      raceFinishes: [],
      gameUnsubscribed: false,
      gameRoomDisconnected: false,
    },
  }
}

function createLoginRuntime(harness) {
  return {
    dataMode: 'mock',
    viewState: 'default',
    nickname: '',
    sessionPort: {
      async createSession() {
        return {
          ok: true,
          value: session,
        }
      },
      async validateSession() {
        return {
          ok: true,
          value: harness.storedSession,
        }
      },
    },
    storagePort: createSessionStoragePort(harness),
    routePort: {
      navigateMain: () => harness.routeChanges.push(['main']),
    },
    getCurrentState() {
      return this.viewState
    },
    setViewState(nextState) {
      this.viewState = nextState
    },
    setNickname(nextNickname) {
      this.nickname = nextNickname
    },
  }
}

function createMainRuntime(harness) {
  const runtime = {
    dataMode: 'mock',
    state: mainCore.createInitialMainControllerState(),
    savedSettings: [],
    sessionStoragePort: createSessionStoragePort(harness),
    settingsStoragePort: {
      loadSettings: () => ({
        bgmVolume: 70,
        sfxVolume: 82,
        muted: false,
        nickname: '릴레이러',
        issuedCode: undefined,
        deviceCodeInput: '',
      }),
      saveSettings(settings) {
        runtime.savedSettings.push(settings)
      },
    },
    sessionPort: {
      async updateNickname(_session, nickname) {
        return {
          ok: true,
          value: {
            ...session,
            nickname,
          },
        }
      },
    },
    assetPort: {
      async loadMainSnapshot() {
        return {
          ok: true,
          value: {
            mainState: 'systemAvatar',
            avatar: {
              state: 'system',
              title: '기본 아바타',
              description: '아바타가 없어도 바로 게임을 시작할 수 있어요.',
              statusText: '사용 가능',
            },
            assetSummary: {
              total: 0,
              ready: 0,
              working: 0,
              failed: 0,
            },
          },
        }
      },
    },
    deviceLinkPort: {
      async issueDeviceCode() {
        return {
          ok: true,
          value: {
            code: 'TIGER-3392',
            expiresAtMs: Date.now() + 300_000,
          },
        }
      },
      async consumeDeviceCode() {
        return {
          ok: true,
          value: session,
        }
      },
    },
    routePort: {
      navigateLogin: () => harness.routeChanges.push(['login']),
      navigateLobby: () => harness.routeChanges.push(['lobby']),
      navigateAssetStudio: () => harness.routeChanges.push(['asset-studio']),
      navigateWarehouse: (tab) => harness.routeChanges.push(['warehouse', tab]),
    },
    getState: () => runtime.state,
    setState(updater) {
      runtime.state = updater(runtime.state)
    },
  }

  return runtime
}

function createRoomRuntime(harness) {
  let state = roomCore.createInitialRoomControllerState()

  state = {
    ...state,
    session,
    createForm: {
      name: createdRoom.name,
      isPublic: true,
      password: '',
      maxPlayers: createdRoom.maxPlayers,
    },
  }

  const runtime = {
    dataMode: 'mock',
    state,
    calls: {
      createRoom: 0,
      getRoomSnapshot: 0,
      startRoom: 0,
    },
    sessionStoragePort: createSessionStoragePort(harness),
    roomPort: {
      async listRooms() {
        return {
          ok: true,
          value: [createdRoom],
        }
      },
      async getRoomSnapshot() {
        runtime.calls.getRoomSnapshot += 1
        return {
          ok: true,
          value: createRoomSnapshot('lobby'),
        }
      },
      async createRoom() {
        runtime.calls.createRoom += 1
        return {
          ok: true,
          value: createdRoom,
        }
      },
      async joinPublicRoom() {
        return {
          ok: true,
          value: createdRoom,
        }
      },
      async joinRoom() {
        return {
          ok: true,
          value: createdRoom,
        }
      },
      async startRoom() {
        runtime.calls.startRoom += 1
        return {
          ok: true,
          value: {
            ...createdRoom,
            phase: 'building',
            phaseEndsAt: '2026-07-14T00:03:00.000Z',
          },
        }
      },
      async setReady() {
        return {
          ok: true,
          value: createRoomSnapshot('lobby'),
        }
      },
      async leaveRoom() {
        return {
          ok: true,
          value: null,
        }
      },
    },
    roomRealtime: {
      getConnectionStatus: () => ({ status: 'online' }),
      async connect() {
        return {
          ok: true,
          value: undefined,
        }
      },
      disconnect: () => undefined,
      joinRoom: (payload) => harness.realtime.roomJoins.push(payload),
      leaveRoom: () => undefined,
      setReady: () => undefined,
      startRoom: (payload) => harness.realtime.roomStarts.push(payload),
    },
    routePort: {
      navigateLogin: () => harness.routeChanges.push(['login']),
      navigateMain: () => harness.routeChanges.push(['main']),
      navigateLobby: () => harness.routeChanges.push(['lobby']),
      navigateRoom: (roomId) => harness.routeChanges.push(['room', roomId]),
      navigateMapBuild: (roomId) => harness.routeChanges.push(['map-build', roomId]),
    },
    getState: () => runtime.state,
    setState(updater) {
      runtime.state = updater(runtime.state)
    },
  }

  return runtime
}

function createGameRuntime(harness) {
  const runtime = {
    dataMode: 'mock',
    state: gameCore.createInitialGamePhaseControllerState(
      { kind: 'mapBuild', roomId: createdRoom.id },
      createMapBuildFixture(),
    ),
    calls: {
      getRoomSnapshot: 0,
      saveMapSegment: 0,
      validateMapSegment: 0,
      mergeRoomMap: 0,
      finishRace: 0,
    },
    sessionStoragePort: createSessionStoragePort(harness),
    roomPort: {
      async getRoomSnapshot() {
        runtime.calls.getRoomSnapshot += 1
        return {
          ok: true,
          value: createGameRoomSnapshot('building'),
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
        return {
          ok: true,
          value: segment,
        }
      },
      async validateMapSegment() {
        runtime.calls.validateMapSegment += 1
        return {
          ok: true,
          value: {
            ...segment,
            isValidated: true,
            validatedAt: '2026-07-14T00:02:00.000Z',
            clearTimeMs: 61_400,
            roomPhase: 'merging',
          },
        }
      },
      async mergeRoomMap() {
        runtime.calls.mergeRoomMap += 1
        return {
          ok: true,
          value: mergedMap,
        }
      },
      async getMergedMap() {
        return {
          ok: true,
          value: mergedMap,
        }
      },
      async saveRaceProgress() {
        return {
          ok: true,
          value: createRaceResult('racing'),
        }
      },
      async finishRace() {
        runtime.calls.finishRace += 1
        return {
          ok: true,
          value: createRaceResult('finished'),
        }
      },
      async getRaceResults() {
        return {
          ok: true,
          value: createRaceResult('finished'),
        }
      },
    },
    roomRealtime: {
      getStatus() {
        return 'offline'
      },
      async connect() {
        return {
          ok: true,
          data: undefined,
        }
      },
      disconnect() {
        harness.realtime.gameRoomDisconnected = true
      },
      joinRoom(payload) {
        harness.realtime.gameRoomJoins.push(payload)
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
        harness.realtime.readyMarks.push(payload)
      },
      requestTimeVote() {
        return undefined
      },
      submitSegment(payload) {
        harness.realtime.submittedSegments.push(payload)
      },
      publishValidationResult(payload) {
        harness.realtime.validationResults.push(payload)
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
        harness.realtime.raceFinishes.push(payload)
      },
      subscribe() {
        return () => {
          harness.realtime.gameUnsubscribed = true
        }
      },
    },
    routePort: {
      navigateLogin: () => harness.routeChanges.push(['login']),
      navigateLobby: () => harness.routeChanges.push(['lobby']),
      navigateRoom: (roomId) => harness.routeChanges.push(['room', roomId]),
      navigateMapBuild: (roomId) => harness.routeChanges.push(['map-build', roomId]),
      navigateValidation: (roomId, segmentId) => harness.routeChanges.push(['validation', roomId, segmentId]),
      navigateMerging: (roomId) => harness.routeChanges.push(['merging', roomId]),
      navigateRace: (roomId, mergedMapId) => harness.routeChanges.push(['race', roomId, mergedMapId]),
      navigateResults: (roomId) => harness.routeChanges.push(['results', roomId]),
    },
    getState: () => runtime.state,
    setState(updater) {
      runtime.state = updater(runtime.state)
    },
  }

  return runtime
}

function createSessionStoragePort(harness) {
  return {
    loadSession: () => harness.storedSession,
    saveSession(nextSession) {
      harness.storedSession = nextSession
    },
    clearSession() {
      harness.storedSession = null
    },
  }
}

function createRoomSnapshot(phase) {
  return {
    roomId: createdRoom.id,
    phase,
    phaseEndsAt: phase === 'lobby' ? null : '2026-07-14T00:03:00.000Z',
    players: [
      {
        userId: session.id,
        nickname: session.nickname,
        isHost: true,
        isReady: true,
      },
      guest,
    ],
  }
}

function createGameRoomSnapshot(phase) {
  return {
    ...createRoomSnapshot(phase),
    players: createRoomSnapshot(phase).players.map((player) => ({
      ...player,
      validationCleared: phase !== 'building',
      raceProgress: phase === 'finished' ? 100 : 0,
      raceFinishedAtMs: phase === 'finished' ? 1_000 : null,
      raceDistanceToGoal: phase === 'finished' ? 0 : 100,
    })),
  }
}

function createMapBuildFixture() {
  return {
    id: 'flow-map-build',
    screenId: 'S4_MAP_BUILD',
    title: '맵 제작',
    description: 'flow test',
    state: 'editing',
    viewport: '1280x720',
    roomId: createdRoom.id,
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
        id: session.id,
        nickname: session.nickname,
        isHost: true,
        isReady: false,
        validationCleared: false,
        raceProgress: 0,
        raceFinishedAtMs: null,
        raceDistanceToGoal: 100,
      },
      {
        id: guest.userId,
        nickname: guest.nickname,
        isHost: false,
        isReady: true,
        validationCleared: false,
        raceProgress: 0,
        raceFinishedAtMs: null,
        raceDistanceToGoal: 100,
      },
    ],
    testSegment: segment,
  }
}

function createRaceResult(roomPhase) {
  return {
    roomId: createdRoom.id,
    roomPhase,
    players: [
      {
        userId: session.id,
        nickname: session.nickname,
        isHost: true,
        isReady: true,
        validationCleared: true,
        raceProgress: 100,
        raceFinishedAtMs: 1_000,
        raceDistanceToGoal: 0,
        rank: 1,
      },
      {
        userId: guest.userId,
        nickname: guest.nickname,
        isHost: false,
        isReady: true,
        validationCleared: true,
        raceProgress: 100,
        raceFinishedAtMs: 1_500,
        raceDistanceToGoal: 0,
        rank: 2,
      },
    ],
  }
}

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
