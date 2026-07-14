import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')

const remoteSessionSource = read('client/src/infrastructure/session/remoteSessionPort.ts')
const remoteRoomSource = read('client/src/infrastructure/rooms/remoteRoomPort.ts')
const remoteGameSource = read('client/src/infrastructure/game/remoteGameRoomPort.ts')

const { createRemoteSessionPort } = await importTypeScriptModule(remoteSessionSource)
const { createRemoteRoomPort } = await importTypeScriptModule(remoteRoomSource)
const { createRemoteGameRoomPort } = await importTypeScriptModule(remoteGameSource)

await testRemotePortsAgainstServerShapedFlow()

assert.doesNotMatch(remoteSessionSource + remoteRoomSource + remoteGameSource, /createMock|Mock fallback|relay\.mock/i)

console.log('remote v2 flow adapter self-test passed')

async function testRemotePortsAgainstServerShapedFlow() {
  const server = createServerContractHarness()
  const options = {
    baseUrl: 'http://api.test',
    fetcher: server.fetch,
  }
  const sessionPort = createRemoteSessionPort(options)
  const roomPort = createRemoteRoomPort(options)
  const gamePort = createRemoteGameRoomPort(options)

  const sessionResult = await sessionPort.createSession('릴레이러')

  assert.equal(sessionResult.ok, true)
  assert.equal(sessionResult.value.nickname, '릴레이러')
  assert.equal(sessionResult.value.token, 'token-a')

  const session = sessionResult.value
  const roomResult = await roomPort.createRoom(
    session,
    {
      name: '원격 계약 테스트방',
      isPublic: true,
      maxPlayers: 2,
    },
    'remote',
  )

  assert.equal(roomResult.ok, true)
  assert.equal(roomResult.value.id, 'room-flow')
  assert.equal(roomResult.value.phase, 'lobby')

  const snapshotResult = await roomPort.getRoomSnapshot(session, roomResult.value.id, 'remote')

  assert.equal(snapshotResult.ok, true)
  assert.equal(snapshotResult.value.players.length, 2)
  assert.equal(snapshotResult.value.players[1].isReady, true)

  const startResult = await roomPort.startRoom(session, roomResult.value.id, 'remote')

  assert.equal(startResult.ok, true)
  assert.equal(startResult.value.phase, 'building')
  assert.equal(typeof startResult.value.phaseEndsAt, 'string')

  const gameSnapshotResult = await gamePort.getRoomSnapshot(session, roomResult.value.id, 'remote')

  assert.equal(gameSnapshotResult.ok, true)
  assert.equal(gameSnapshotResult.value.phase, 'building')
  assert.equal(gameSnapshotResult.value.players[0].isReady, true)

  const segmentResult = await gamePort.saveMapSegment(
    session,
    {
      roomId: roomResult.value.id,
      creatorId: session.id,
      startPoint: { x: 1, y: 7 },
      endPoint: { x: 22, y: 7 },
      placements: [
        {
          id: 'placement-flow',
          x: 4,
          y: 8,
          asset: createPlatformAsset(),
        },
      ],
    },
    'remote',
  )

  assert.equal(segmentResult.ok, true)
  assert.equal(segmentResult.value.id, 'segment-flow')
  assert.equal(segmentResult.value.roomPhase, 'validating')
  assert.equal(server.lastJsonBody('/api/rooms/room-flow/segments').assets[0].assetId, 'platform-flow')

  const validationResult = await gamePort.validateMapSegment(
    session,
    {
      roomId: roomResult.value.id,
      userId: session.id,
      segmentHash: segmentResult.value.segmentHash,
      cleared: true,
      clearTimeMs: 61_400,
    },
    'remote',
  )

  assert.equal(validationResult.ok, true)
  assert.equal(validationResult.value.isValidated, true)
  assert.equal(validationResult.value.roomPhase, 'merging')
  assert.equal(server.lastJsonBody('/api/rooms/room-flow/segments/validate').segment_hash, 'hash-flow')

  const mergeResult = await gamePort.mergeRoomMap(session, roomResult.value.id, 'remote')

  assert.equal(mergeResult.ok, true)
  assert.equal(mergeResult.value.id, 'merged-flow')
  assert.equal(mergeResult.value.usedFallback, false)

  const finishResult = await gamePort.finishRace(
    session,
    {
      roomId: roomResult.value.id,
      userId: session.id,
      finishTimeMs: 73_400,
    },
    'remote',
  )

  assert.equal(finishResult.ok, true)
  assert.equal(finishResult.value.roomPhase, 'finished')
  assert.equal(finishResult.value.players[0].raceFinishedAtMs, 73_400)
  assert.equal(server.lastJsonBody('/api/rooms/room-flow/race/finish').finish_time_ms, 73_400)

  const resultsResult = await gamePort.getRaceResults(session, roomResult.value.id, 'remote')

  assert.equal(resultsResult.ok, true)
  assert.equal(resultsResult.value.players[0].rank, 1)
  assert.deepEqual(server.calls.map((call) => `${call.method} ${call.pathname}`), [
    'POST /api/session',
    'POST /api/rooms',
    'GET /api/rooms/room-flow',
    'POST /api/rooms/room-flow/start',
    'GET /api/rooms/room-flow',
    'POST /api/rooms/room-flow/segments',
    'POST /api/rooms/room-flow/segments/validate',
    'POST /api/rooms/room-flow/merge',
    'POST /api/rooms/room-flow/race/finish',
    'GET /api/rooms/room-flow/results',
  ])
}

function createServerContractHarness() {
  const calls = []
  let phase = 'lobby'
  let phaseEndsAt = null
  let segment = createSegmentResponse(false)
  let mergedMap = createMergedMapResponse()
  let raceResult = createRaceResultResponse('racing')

  return {
    calls,
    async fetch(input, init = {}) {
      const url = new URL(String(input))
      const method = init.method ?? 'GET'
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : null
      const auth = init.headers?.Authorization ?? init.headers?.authorization

      calls.push({
        method,
        pathname: url.pathname,
        body,
        auth,
      })

      if (url.pathname !== '/api/session' && auth !== 'Bearer token-a') {
        return json({ error: { message: '로그인이 필요해요.' } }, 401)
      }

      if (method === 'POST' && url.pathname === '/api/session') {
        return json({
          session: {
            id: 'user-a',
            nickname: body.nickname,
            token: 'token-a',
            avatarAssetId: null,
          },
        })
      }

      if (method === 'POST' && url.pathname === '/api/rooms') {
        assert.equal(body.user_id, 'user-a')
        assert.equal(body.name, '원격 계약 테스트방')
        return json({ room: createRoomResponse(phase, phaseEndsAt) }, 201)
      }

      if (method === 'GET' && url.pathname === '/api/rooms/room-flow') {
        return json({
          room: createRoomResponse(phase, phaseEndsAt),
          players: createPlayersResponse(),
        })
      }

      if (method === 'POST' && url.pathname === '/api/rooms/room-flow/start') {
        phase = 'building'
        phaseEndsAt = '2026-07-14T00:03:00.000Z'
        return json({ room: createRoomResponse(phase, phaseEndsAt) })
      }

      if (method === 'POST' && url.pathname === '/api/rooms/room-flow/segments') {
        assert.deepEqual(body.start_point, { x: 1, y: 7 })
        assert.deepEqual(body.end_point, { x: 22, y: 7 })
        phase = 'validating'
        phaseEndsAt = '2026-07-14T00:04:30.000Z'
        segment = createSegmentResponse(false)
        return json({ segment, room: createRoomResponse(phase, phaseEndsAt) }, 201)
      }

      if (method === 'POST' && url.pathname === '/api/rooms/room-flow/segments/validate') {
        assert.equal(body.cleared, true)
        phase = 'merging'
        phaseEndsAt = null
        segment = createSegmentResponse(true)
        return json({ segment, room: createRoomResponse(phase, phaseEndsAt) })
      }

      if (method === 'POST' && url.pathname === '/api/rooms/room-flow/merge') {
        phase = 'racing'
        phaseEndsAt = '2026-07-14T00:09:30.000Z'
        mergedMap = createMergedMapResponse()
        return json({ mergedMap, room: createRoomResponse(phase, phaseEndsAt) })
      }

      if (method === 'POST' && url.pathname === '/api/rooms/room-flow/race/finish') {
        phase = 'finished'
        phaseEndsAt = null
        raceResult = createRaceResultResponse('finished')
        return json({ result: raceResult, room: createRoomResponse(phase, phaseEndsAt) })
      }

      if (method === 'GET' && url.pathname === '/api/rooms/room-flow/results') {
        return json({ result: raceResult })
      }

      return json({
        error: {
          message: `${method} ${url.pathname}`,
        },
      }, 500)
    },
    lastJsonBody(pathname) {
      const call = [...calls].reverse().find((candidate) => candidate.pathname === pathname)

      assert.ok(call, `missing call ${pathname}`)

      return call.body
    },
  }
}

function createRoomResponse(phase, phaseEndsAt) {
  return {
    id: 'room-flow',
    name: '원격 계약 테스트방',
    host_id: 'user-a',
    host_nickname: '릴레이러',
    is_public: true,
    players: 2,
    max_players: 2,
    phase,
    elapsed_seconds: 0,
    phase_ends_at: phaseEndsAt,
  }
}

function createPlayersResponse() {
  return [
    {
      user_id: 'user-a',
      nickname: '릴레이러',
      is_host: true,
      is_ready: true,
      validation_cleared: true,
      race_progress: 100,
      race_finished_at_ms: 73_400,
      race_distance_to_goal: 0,
    },
    {
      user_id: 'user-b',
      nickname: '게스트',
      is_host: false,
      is_ready: true,
      validation_cleared: true,
      race_progress: 100,
      race_finished_at_ms: 81_200,
      race_distance_to_goal: 0,
    },
  ]
}

function createSegmentResponse(isValidated) {
  return {
    id: 'segment-flow',
    room_id: 'room-flow',
    creator_id: 'user-a',
    start_point: { x: 1, y: 7 },
    end_point: { x: 22, y: 7 },
    placements: [
      {
        id: 'placement-flow',
        x: 4,
        y: 8,
        asset: createPlatformAsset(),
      },
    ],
    assets: [
      {
        asset_id: 'platform-flow',
        asset_category: 'platform',
        asset_attrs: {},
        collider_type: 'rect',
        x: 4,
        y: 8,
        width_cells: 2,
        height_cells: 1,
        rotation: 0,
      },
    ],
    segment_hash: 'hash-flow',
    is_validated: isValidated,
    submitted_at: '2026-07-14T00:01:00.000Z',
    validated_at: isValidated ? '2026-07-14T00:02:00.000Z' : null,
    clear_time_ms: isValidated ? 61_400 : null,
  }
}

function createMergedMapResponse() {
  return {
    id: 'merged-flow',
    room_id: 'room-flow',
    global_start: { x: 1, y: 7 },
    global_end: { x: 22, y: 7 },
    placements: [
      {
        asset_id: 'platform-flow',
        asset_category: 'platform',
        asset_attrs: {},
        collider_type: 'rect',
        x: 4,
        y: 8,
        width_cells: 2,
        height_cells: 1,
        rotation: 0,
        source_segment_id: 'segment-flow',
      },
    ],
    segments: [createSegmentResponse(true)],
    used_fallback: false,
    created_at: '2026-07-14T00:02:00.000Z',
  }
}

function createRaceResultResponse(roomPhase) {
  return {
    room_id: 'room-flow',
    roomPhase,
    players: [
      {
        user_id: 'user-a',
        nickname: '릴레이러',
        is_host: true,
        is_ready: true,
        validation_cleared: true,
        race_progress: 100,
        race_finished_at_ms: 73_400,
        race_distance_to_goal: 0,
        rank: 1,
      },
      {
        user_id: 'user-b',
        nickname: '게스트',
        is_host: false,
        is_ready: true,
        validation_cleared: true,
        race_progress: 100,
        race_finished_at_ms: 81_200,
        race_distance_to_goal: 0,
        rank: 2,
      },
    ],
    updated_at: '2026-07-14T00:10:00.000Z',
  }
}

function createPlatformAsset() {
  return {
    id: 'platform-flow',
    creator_id: null,
    is_system: true,
    category: 'platform',
    name: '발판',
    description: '',
    attrs: {},
    collider_type: 'rect',
    width_cells: 2,
    height_cells: 1,
    source_image_url: '',
    remix_of_id: null,
    status: 'ready',
    is_public: true,
    created_at: '2026-07-14T00:00:00.000Z',
    sprites: [],
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
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
