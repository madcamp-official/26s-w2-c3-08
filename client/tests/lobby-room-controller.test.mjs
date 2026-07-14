import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')

const coreSource = read('client/src/pages/room/roomControllerCore.ts')
const lobbyScreenSource = read('client/src/pages/lobby/LobbyScreen.tsx')
const roomScreenSource = read('client/src/pages/room/RoomScreen.tsx')
const lobbyControllerSource = read('client/src/pages/lobby/LobbyController.tsx')
const roomControllerSource = read('client/src/pages/room/RoomController.tsx')
const hookSource = read('client/src/pages/room/useRoomController.ts')
const mockRoomSource = read('client/src/infrastructure/rooms/mockRoomPort.ts')
const remoteRoomSource = read('client/src/infrastructure/rooms/remoteRoomPort.ts')
const localRealtimeSource = read('client/src/infrastructure/rooms/localRoomRealtime.ts')
const remoteRealtimeSource = read('client/src/infrastructure/rooms/remoteRoomRealtime.ts')
const routerSource = read('client/src/app/navigation/prototypeRouter.ts')
const appSource = read('client/src/app/AppV2.tsx')
const stateGallerySource = read('client/src/dev/state-gallery/StateGallery.tsx')
const stateGalleryFixturesSource = read('client/src/dev/state-gallery/fixtures.ts')
const packageSource = read('client/package.json')

const core = await importTypeScriptModule(coreSource)

await testLobbyStateMapping(core)
await testCreateRoomConnectsAndRoutes(core)
await testPrivatePasswordError(core)
await testFullAndPlayingBlocked(core)
await testReadySyncAndLeave(core)
await testStartBlockedAndAllowed(core)
await testReconnectState(core)

assert.equal(statSync(join(repoRoot, 'client/src/pages/lobby/LobbyController.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/pages/room/RoomController.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/rooms/mockRoomPort.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/rooms/remoteRoomPort.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/rooms/localRoomRealtime.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/rooms/remoteRoomRealtime.ts')).isFile(), true)

assert.match(coreSource, /export interface RoomPort/)
assert.match(coreSource, /export interface RoomRealtime/)
assert.match(coreSource, /phaseEndsAt: string \| null/)
assert.match(coreSource, /bootLobbyController/)
assert.match(coreSource, /bootRoomController/)
assert.match(coreSource, /getRoomSnapshot/)
assert.match(coreSource, /quickJoinPublicRoom/)
assert.match(coreSource, /joinLobbyRoom/)
assert.match(coreSource, /toggleRoomReady/)
assert.match(coreSource, /roomPort\.setReady/)
assert.match(coreSource, /startRoom/)
assert.match(coreSource, /roomPort\.startRoom/)
assert.match(coreSource, /leaveRoom/)
assert.match(coreSource, /roomPort\.leaveRoom/)
assert.match(coreSource, /handleRoomConnectionStatus/)
assert.match(coreSource, /mapRoomSummaryToLobbyViewModel/)
assert.match(coreSource, /createRoomSlots/)

assert.match(lobbyScreenSource, /data-v2-screen="s3-lobby"/)
assert.match(lobbyScreenSource, /RoomCard/)
assert.match(lobbyScreenSource, /CreateRoomPanel/)
assert.match(lobbyScreenSource, /비공개방 입장/)
assert.match(roomScreenSource, /data-v2-screen="c-room"/)
assert.match(roomScreenSource, /PlayerSlot/)
assert.match(roomScreenSource, /준비 취소/)
assert.match(roomScreenSource, /제작 시작/)

assert.match(lobbyControllerSource, /createMockRoomPort/)
assert.match(lobbyControllerSource, /createRemoteRoomPort/)
assert.match(lobbyControllerSource, /createLocalRoomRealtime/)
assert.match(lobbyControllerSource, /createRemoteRoomRealtime/)
assert.match(lobbyControllerSource, /setPrototypeRoute\('room'/)
assert.match(lobbyControllerSource, /setPrototypeRoute\('map-build'/)
assert.match(roomControllerSource, /<RoomScreen/)
assert.match(hookSource, /bootLobbyController/)
assert.match(hookSource, /bootRoomController/)
assert.match(hookSource, /roomRealtime\.disconnect/)

assert.match(mockRoomSource, /mock-room-public-open/)
assert.match(mockRoomSource, /mock-room-private-open/)
assert.match(mockRoomSource, /mock-room-full/)
assert.match(mockRoomSource, /mock-room-playing/)
assert.match(mockRoomSource, /phase: 'building'/)
assert.match(mockRoomSource, /createPhaseEndsAt/)
assert.match(remoteRoomSource, /\/api\/rooms/)
assert.match(remoteRoomSource, /phaseEndsAt: readString\(room\.phaseEndsAt\)/)
assert.match(remoteRoomSource, /\/api\/rooms\/public\/join/)
assert.match(remoteRoomSource, /\/ready/)
assert.match(remoteRoomSource, /\/leave/)
assert.match(remoteRoomSource, /\/start/)
assert.match(remoteRoomSource, /authorization/)
assert.doesNotMatch(remoteRoomSource, /createMock|Mock fallback/i)
assert.match(localRealtimeSource, /BroadcastChannel/)
assert.match(localRealtimeSource, /player-joined/)
assert.match(localRealtimeSource, /ready-changed/)
assert.match(remoteRealtimeSource, /createSocketIoRemoteRealtimeAdapters/)
assert.match(remoteRealtimeSource, /방 실시간 연결을 사용할 수 없어요/)
assert.doesNotMatch(remoteRealtimeSource, /BroadcastChannel|createLocal|Mock fallback/i)

assert.match(routerSource, /kind: 'room'/)
assert.match(routerSource, /screenId: 'C_ROOM_LOBBY'/)
assert.match(routerSource, /kind: 'mapBuild'/)
assert.match(appSource, /<LobbyController \/>/)
assert.match(appSource, /<RoomController roomId=\{route\.contractRoute\.roomId\} \/>/)
assert.match(stateGalleryFixturesSource, /lobbyScreenFixtures/)
assert.match(stateGalleryFixturesSource, /roomScreenFixtures/)
assert.match(stateGallerySource, /<LobbyScreen/)
assert.match(stateGallerySource, /<RoomScreen/)
assert.match(packageSource, /lobby-room:check/)

for (const source of [lobbyScreenSource, roomScreenSource]) {
  assert.doesNotMatch(
    source,
    /RoomPort|RoomRealtime|StoragePort|resolveV2ModeConfig|localStorage|\/api\/|room:join|room:ready|socket/i,
  )
}

console.log('lobby/room controller contract self-test passed')

async function testLobbyStateMapping({
  createInitialRoomControllerState,
  createLobbyScreenProps,
}) {
  const runtime = createRuntime(createInitialRoomControllerState, {
    rooms: [publicRoom(), privateRoom(), fullRoom(), playingRoom(), buildingRoom(), lateBuildingRoom()],
  })
  const props = createLobbyScreenProps(runtime)

  assert.equal(props.state, 'publicOpen')
  assert.deepEqual(props.rooms.map((room) => room.state), ['open', 'private', 'full', 'playing', 'open', 'playing'])
  assert.equal(props.rooms[2].disabledReason, '정원이 찼어요.')
  assert.match(props.rooms[3].disabledReason, /게임 중/)
  assert.equal(props.rooms[4].disabledReason, undefined)
  assert.match(props.rooms[5].disabledReason, /게임 중/)
}

async function testCreateRoomConnectsAndRoutes({
  createInitialRoomControllerState,
  createLobbyRoom,
}) {
  const createdRoom = publicRoom({ id: 'created-room', name: '새 테스트방', hostId: 'user-a' })
  const runtime = createRuntime(createInitialRoomControllerState, {
    createRoomResult: { ok: true, value: createdRoom },
  })

  await createLobbyRoom(runtime)

  assert.equal(runtime.calls.createRoom, 1)
  assert.equal(runtime.calls.connect, 1)
  assert.deepEqual(runtime.realtimeJoins[0], {
    roomId: 'created-room',
    userId: 'user-a',
    nickname: '릴레이러',
    isHost: true,
  })
  assert.deepEqual(runtime.routeChanges.at(-1), ['room', 'created-room'])
}

async function testPrivatePasswordError({
  createInitialRoomControllerState,
  joinLobbyRoom,
}) {
  const runtime = createRuntime(createInitialRoomControllerState, {
    rooms: [privateRoom()],
    joinRoomResult: {
      ok: false,
      error: {
        kind: 'authorization',
        message: '비밀번호를 확인해주세요.',
        retryable: true,
      },
    },
  })

  const result = await joinLobbyRoom(runtime, 'private-room', 'wrong')

  assert.equal(result.reason, 'authorization')
  assert.equal(runtime.state.lobbyStateOverride, 'passwordError')
  assert.equal(runtime.state.lastErrorMessage, '비밀번호를 확인해주세요.')
}

async function testFullAndPlayingBlocked({
  createInitialRoomControllerState,
  joinLobbyRoom,
}) {
  const runtime = createRuntime(createInitialRoomControllerState, {
    rooms: [fullRoom(), playingRoom(), buildingRoom(), lateBuildingRoom()],
    joinRoomResult: {
      ok: true,
      value: buildingRoom({ id: 'building-room' }),
    },
  })

  const fullResult = await joinLobbyRoom(runtime, 'full-room')
  const playingResult = await joinLobbyRoom(runtime, 'playing-room')
  const buildingResult = await joinLobbyRoom(runtime, 'building-room')
  const lateBuildingResult = await joinLobbyRoom(runtime, 'late-building-room')

  assert.equal(fullResult.reason, 'full')
  assert.equal(playingResult.reason, 'playing')
  assert.equal(buildingResult.ok, true)
  assert.equal(lateBuildingResult.reason, 'playing')
  assert.equal(runtime.calls.joinRoom, 1)
}

async function testReadySyncAndLeave({
  createInitialRoomControllerState,
  createRoomScreenProps,
  handleRoomRealtimeSnapshot,
  leaveRoom,
  toggleRoomReady,
}) {
  const runtime = createRuntime(createInitialRoomControllerState, {
    currentRoomId: 'room-ready',
    currentRoom: roomSnapshot({
      roomId: 'room-ready',
      players: [
        { userId: 'host-1', nickname: '방장', isHost: true, isReady: true },
        { userId: 'user-a', nickname: '릴레이러', isHost: false, isReady: false },
      ],
    }),
  })

  await toggleRoomReady(runtime)
  assert.equal(runtime.calls.setReady, 1)
  assert.deepEqual(runtime.readyChanges[0], {
    roomId: 'room-ready',
    userId: 'user-a',
    isReady: true,
  })

  handleRoomRealtimeSnapshot(runtime, roomSnapshot({
    roomId: 'room-ready',
    players: [
      { userId: 'host-1', nickname: '방장', isHost: true, isReady: true },
      { userId: 'user-a', nickname: '릴레이러', isHost: false, isReady: true },
    ],
  }))

  assert.equal(createRoomScreenProps(runtime).state, 'ready')

  await leaveRoom(runtime)
  assert.equal(runtime.calls.leaveRoom, 1)
  assert.deepEqual(runtime.leaves[0], { roomId: 'room-ready', userId: 'user-a' })
  assert.deepEqual(runtime.routeChanges.at(-1), ['lobby'])
}

async function testStartBlockedAndAllowed({
  createInitialRoomControllerState,
  startRoom,
}) {
  const blockedRuntime = createRuntime(createInitialRoomControllerState, {
    currentRoomId: 'room-start-blocked',
    currentRoom: roomSnapshot({
      roomId: 'room-start-blocked',
      players: [{ userId: 'user-a', nickname: '릴레이러', isHost: true, isReady: true }],
    }),
  })

  await startRoom(blockedRuntime)
  assert.equal(blockedRuntime.state.roomStateOverride, 'notEnoughPlayers')
  assert.equal(blockedRuntime.starts.length, 0)
  assert.equal(blockedRuntime.calls.startRoom, 0)

  const allowedRuntime = createRuntime(createInitialRoomControllerState, {
    currentRoomId: 'room-start-ready',
    currentRoom: roomSnapshot({
      roomId: 'room-start-ready',
      players: [
        { userId: 'user-a', nickname: '릴레이러', isHost: true, isReady: true },
        { userId: 'guest-1', nickname: '손님', isHost: false, isReady: true },
      ],
    }),
  })

  await startRoom(allowedRuntime)
  assert.equal(allowedRuntime.calls.startRoom, 1)
  assert.equal(allowedRuntime.state.rooms[0].phase, 'building')
  assert.equal(allowedRuntime.state.currentRoom.phaseEndsAt, allowedRuntime.state.rooms[0].phaseEndsAt)
  assert.deepEqual(allowedRuntime.starts[0], { roomId: 'room-start-ready', userId: 'user-a' })
  assert.deepEqual(allowedRuntime.routeChanges.at(-1), ['map-build', 'room-start-ready'])
}

async function testReconnectState({
  createInitialRoomControllerState,
  createRoomScreenProps,
  handleRoomConnectionStatus,
}) {
  const runtime = createRuntime(createInitialRoomControllerState, {
    currentRoomId: 'room-reconnect',
    currentRoom: roomSnapshot({ roomId: 'room-reconnect' }),
  })

  handleRoomConnectionStatus(runtime, 'reconnecting', '방 상태를 다시 연결하고 있어요.')

  const props = createRoomScreenProps(runtime)

  assert.equal(props.state, 'reconnecting')
  assert.equal(props.connectionStatus, 'reconnecting')
  assert.match(props.errorMessage, /다시 연결/)
}

function createRuntime(createInitialRoomControllerState, options = {}) {
  let state = createInitialRoomControllerState(options.currentRoomId)
  state = {
    ...state,
    session: createSession(),
    rooms: options.rooms ?? [],
    currentRoomId: options.currentRoomId ?? state.currentRoomId,
    currentRoomName: options.currentRoomName ?? state.currentRoomName,
    currentRoom: options.currentRoom ?? state.currentRoom,
  }

  const runtime = {
    state,
    calls: {
      listRooms: 0,
      createRoom: 0,
      joinPublicRoom: 0,
      joinRoom: 0,
      getRoomSnapshot: 0,
      setReady: 0,
      leaveRoom: 0,
      startRoom: 0,
      connect: 0,
    },
    routeChanges: [],
    realtimeJoins: [],
    readyChanges: [],
    starts: [],
    leaves: [],
    dataMode: 'mock',
    sessionStoragePort: {
      loadSession: () => runtime.state.session,
      saveSession: (session) => {
        runtime.state = { ...runtime.state, session }
      },
      clearSession: () => {
        runtime.state = { ...runtime.state, session: null }
      },
    },
    roomPort: {
      async listRooms() {
        runtime.calls.listRooms += 1
        return options.listRoomsResult ?? { ok: true, value: runtime.state.rooms }
      },
      async getRoomSnapshot() {
        runtime.calls.getRoomSnapshot += 1
        return options.getRoomSnapshotResult ?? {
          ok: true,
          value: runtime.state.currentRoom ?? roomSnapshot({ roomId: runtime.state.currentRoomId ?? 'room' }),
        }
      },
      async createRoom() {
        runtime.calls.createRoom += 1
        return options.createRoomResult ?? { ok: true, value: publicRoom({ id: 'created-room' }) }
      },
      async joinPublicRoom() {
        runtime.calls.joinPublicRoom += 1
        return options.joinPublicRoomResult ?? { ok: true, value: publicRoom() }
      },
      async joinRoom() {
        runtime.calls.joinRoom += 1
        return options.joinRoomResult ?? { ok: true, value: publicRoom() }
      },
      async setReady(_session, roomId, isReady) {
        runtime.calls.setReady += 1
        return options.setReadyResult ?? {
          ok: true,
          value: roomSnapshot({
            roomId,
            players: [
              { userId: 'host-1', nickname: '방장', isHost: true, isReady: true },
              { userId: 'user-a', nickname: '릴레이러', isHost: false, isReady },
            ],
          }),
        }
      },
      async leaveRoom() {
        runtime.calls.leaveRoom += 1
        return options.leaveRoomResult ?? { ok: true, value: null }
      },
      async startRoom() {
        runtime.calls.startRoom += 1
        return options.startRoomResult ?? {
          ok: true,
          value: publicRoom({
            id: runtime.state.currentRoomId,
            phase: 'building',
            phaseEndsAt: '2026-07-14T00:03:00.000Z',
          }),
        }
      },
    },
    roomRealtime: {
      getConnectionStatus: () => ({ status: 'online' }),
      async connect() {
        runtime.calls.connect += 1
        return options.connectResult ?? { ok: true, value: undefined }
      },
      disconnect: () => undefined,
      joinRoom: (payload) => {
        runtime.realtimeJoins.push(payload)
      },
      leaveRoom: (payload) => {
        runtime.leaves.push(payload)
      },
      setReady: (payload) => {
        runtime.readyChanges.push(payload)
      },
      startRoom: (payload) => {
        runtime.starts.push(payload)
      },
    },
    routePort: {
      navigateLogin: () => runtime.routeChanges.push(['login']),
      navigateMain: () => runtime.routeChanges.push(['main']),
      navigateLobby: () => runtime.routeChanges.push(['lobby']),
      navigateRoom: (roomId) => runtime.routeChanges.push(['room', roomId]),
      navigateMapBuild: (roomId) => runtime.routeChanges.push(['map-build', roomId]),
    },
    getState: () => runtime.state,
    setState: (updater) => {
      runtime.state = updater(runtime.state)
    },
  }

  return runtime
}

function createSession() {
  return {
    id: 'user-a',
    nickname: '릴레이러',
    token: 'token-a',
    avatarAssetId: 'avatar-a',
  }
}

function publicRoom(patch = {}) {
  return {
    id: 'public-room',
    name: '공개 릴레이 방',
    hostId: 'host-1',
    hostNickname: '방장',
    isPublic: true,
    players: 1,
    maxPlayers: 4,
    phase: 'lobby',
    elapsedSeconds: 0,
    phaseEndsAt: null,
    ...patch,
  }
}

function privateRoom(patch = {}) {
  return publicRoom({
    id: 'private-room',
    name: '비공개방',
    isPublic: false,
    ...patch,
  })
}

function fullRoom(patch = {}) {
  return publicRoom({
    id: 'full-room',
    name: '정원 마감 방',
    players: 4,
    maxPlayers: 4,
    ...patch,
  })
}

function playingRoom(patch = {}) {
  return publicRoom({
    id: 'playing-room',
    name: '게임 중인 방',
    players: 2,
    phase: 'racing',
    elapsedSeconds: 187,
    ...patch,
  })
}

function buildingRoom(patch = {}) {
  return publicRoom({
    id: 'building-room',
    name: '제작 중 입장 가능 방',
    players: 2,
    phase: 'building',
    elapsedSeconds: 90,
    phaseEndsAt: new Date(Date.now() + 90_000).toISOString(),
    ...patch,
  })
}

function lateBuildingRoom(patch = {}) {
  return publicRoom({
    id: 'late-building-room',
    name: '제작 마감 임박 방',
    players: 2,
    phase: 'building',
    elapsedSeconds: 130,
    phaseEndsAt: new Date(Date.now() + 30_000).toISOString(),
    ...patch,
  })
}

function roomSnapshot(patch = {}) {
  return {
    roomId: 'room-1',
    phase: 'lobby',
    phaseEndsAt: null,
    players: [
      { userId: 'user-a', nickname: '릴레이러', isHost: true, isReady: true },
    ],
    ...patch,
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
