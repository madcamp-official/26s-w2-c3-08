import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')
const remoteRoomPortSource = read('client/src/infrastructure/rooms/remoteRoomPort.ts')
const remoteRoomRealtimeSource = read('client/src/infrastructure/rooms/remoteRoomRealtime.ts')
const remote = await importTypeScriptModule(remoteRoomPortSource)
const session = {
  id: 'user-a',
  nickname: '릴레이러',
  token: 'token-a',
  avatarAssetId: null,
}

await testRoomListAndSnapshot(remote)
await testRoomMutationsSendServerContract(remote)
await testLeaveEmptyRoomAndErrors(remote)

assert.match(remoteRoomRealtimeSource, /isReady: player\.isReady/)
assert.doesNotMatch(remoteRoomRealtimeSource, /isReady:\s*player\.isHost/)
assert.doesNotMatch(
  remoteRoomPortSource + remoteRoomRealtimeSource,
  /createMock|Mock fallback|relay\.mock|BroadcastChannel/i,
)

console.log('remote room port contract self-test passed')

async function testRoomListAndSnapshot({ createRemoteRoomPort }) {
  const calls = []
  const port = createRemoteRoomPort({
    baseUrl: 'http://api.test',
    fetcher: createFetch(calls, {
      'GET /api/rooms': {
        rooms: [
          createRoomResponse('room-lobby', 'lobby', null),
          createRoomResponse('room-building', 'building'),
        ],
      },
      'GET /api/rooms/room-flow': createSnapshotResponse('room-flow', 'lobby'),
    }),
  })

  const listResult = await port.listRooms(session, 'remote')

  assert.equal(listResult.ok, true)
  assert.equal(listResult.value.length, 2)
  assert.equal(listResult.value[0].id, 'room-lobby')
  assert.equal(listResult.value[0].phaseEndsAt, null)
  assert.equal(listResult.value[1].phase, 'building')
  assert.equal(listResult.value[1].phaseEndsAt, '2026-07-14T00:10:00.000Z')

  const snapshotResult = await port.getRoomSnapshot(session, 'room-flow', 'remote')

  assert.equal(snapshotResult.ok, true)
  assert.equal(snapshotResult.value.roomId, 'room-flow')
  assert.equal(snapshotResult.value.phase, 'lobby')
  assert.deepEqual(snapshotResult.value.players, [
    {
      userId: 'user-a',
      nickname: '릴레이러',
      isHost: true,
      isReady: true,
    },
    {
      userId: 'user-b',
      nickname: '게스트',
      isHost: false,
      isReady: false,
    },
  ])
  assert.equal(calls[0].url, 'http://api.test/api/rooms')
  assert.equal(calls[1].url, 'http://api.test/api/rooms/room-flow')
  assert.equal(calls[1].headers.Authorization, `Bearer ${session.token}`)
}

async function testRoomMutationsSendServerContract({ createRemoteRoomPort }) {
  const calls = []
  const port = createRemoteRoomPort({
    baseUrl: 'http://api.test',
    fetcher: createFetch(calls, {
      'POST /api/rooms': {
        status: 201,
        body: {
          room: createRoomResponse('created-room', 'lobby', null),
        },
      },
      'POST /api/rooms/room-flow/ready': createSnapshotResponse('room-flow', 'lobby', [
        createPlayer('user-a', '릴레이러', true, true),
        createPlayer('user-b', '게스트', false, true),
      ]),
      'POST /api/rooms/room-flow/start': {
        room: createRoomResponse('room-flow', 'building'),
      },
    }),
  })

  const createResult = await port.createRoom(
    session,
    {
      name: '두 context 테스트방',
      isPublic: false,
      password: '1234',
      maxPlayers: 2,
    },
    'remote',
  )

  assert.equal(createResult.ok, true)
  assert.equal(createResult.value.id, 'created-room')
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    user_id: session.id,
    name: '두 context 테스트방',
    is_public: false,
    password: '1234',
    max_players: 2,
  })

  const readyResult = await port.setReady(session, 'room-flow', true, 'remote')

  assert.equal(readyResult.ok, true)
  assert.equal(readyResult.value.players[1].isHost, false)
  assert.equal(readyResult.value.players[1].isReady, true)
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    user_id: session.id,
    is_ready: true,
  })

  const startResult = await port.startRoom(session, 'room-flow', 'remote')

  assert.equal(startResult.ok, true)
  assert.equal(startResult.value.phase, 'building')
  assert.deepEqual(JSON.parse(calls[2].init.body), {
    user_id: session.id,
  })
}

async function testLeaveEmptyRoomAndErrors({ createRemoteRoomPort }) {
  const leavePort = createRemoteRoomPort({
    baseUrl: 'http://api.test',
    fetcher: createFetch([], {
      'POST /api/rooms/room-flow/leave': {
        room: null,
        players: [],
      },
    }),
  })

  const leaveResult = await leavePort.leaveRoom(session, 'room-flow', 'remote')

  assert.equal(leaveResult.ok, true)
  assert.equal(leaveResult.value, null)

  const conflictPort = createRemoteRoomPort({
    baseUrl: 'http://api.test',
    fetcher: createFetch([], {
      'POST /api/rooms/room-flow/start': {
        status: 409,
        body: {
          error: {
            message: '아직 준비하지 않은 플레이어가 있어요.',
          },
        },
      },
    }),
  })

  const conflictResult = await conflictPort.startRoom(session, 'room-flow', 'remote')

  assert.equal(conflictResult.ok, false)
  assert.equal(conflictResult.error.kind, 'conflict')
  assert.equal(conflictResult.error.message, '아직 준비하지 않은 플레이어가 있어요.')

  const offlinePort = createRemoteRoomPort({
    baseUrl: 'http://api.test',
    fetcher: async () => {
      throw new Error('network down')
    },
  })

  const offlineResult = await offlinePort.listRooms(session, 'remote')

  assert.equal(offlineResult.ok, false)
  assert.equal(offlineResult.error.kind, 'server_unavailable')
}

function createFetch(calls, routes) {
  return async (input, init = {}) => {
    const url = new URL(String(input))
    const route = `${init.method ?? 'GET'} ${url.pathname}`
    const responseConfig = routes[route]

    calls.push({
      url: String(input),
      init,
      headers: init.headers,
    })

    if (!responseConfig) {
      return new Response(JSON.stringify({
        error: {
          code: 'TEST_ROUTE_MISSING',
          message: route,
        },
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const status = responseConfig.status ?? 200
    const body = responseConfig.body ?? responseConfig

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function createSnapshotResponse(
  roomId,
  phase,
  players = [
    createPlayer('user-a', '릴레이러', true, true),
    createPlayer('user-b', '게스트', false, false),
  ],
) {
  return {
    room: createRoomResponse(roomId, phase),
    players,
  }
}

function createRoomResponse(roomId, phase, phaseEndsAt = '2026-07-14T00:10:00.000Z') {
  return {
    id: roomId,
    name: '테스트 방',
    host_id: 'user-a',
    host_nickname: '릴레이러',
    is_public: true,
    players: 2,
    max_players: 2,
    phase,
    elapsed_seconds: 12,
    phase_ends_at: phaseEndsAt,
  }
}

function createPlayer(userId, nickname, isHost, isReady) {
  return {
    user_id: userId,
    nickname,
    is_host: isHost,
    is_ready: isReady,
  }
}

async function importTypeScriptModule(source) {
  const output = transpileTypeScript(inlineDiagnosticsImport(source))
  const encoded = Buffer.from(output, 'utf8').toString('base64')

  return import(`data:text/javascript;base64,${encoded}`)
}

function inlineDiagnosticsImport(source) {
  if (!source.includes('malformedResponseLogger')) {
    return source
  }

  const helperUrl = toTypeScriptModuleUrl(read('client/src/infrastructure/diagnostics/malformedResponseLogger.ts'))

  return source.replace(
    /import\s*\{\s*logMalformedResponse,\s*type\s+MalformedResponseReason,\s*\}\s*from\s*['"][^'"]*malformedResponseLogger['"]/g,
    `import { logMalformedResponse } from '${helperUrl}'\ntype MalformedResponseReason = 'invalid_json' | 'unexpected_shape'`,
  )
}

function toTypeScriptModuleUrl(source) {
  const output = transpileTypeScript(source)
  const encoded = Buffer.from(output, 'utf8').toString('base64')

  return `data:text/javascript;base64,${encoded}`
}

function transpileTypeScript(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  }).outputText
}

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
