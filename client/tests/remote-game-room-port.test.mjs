import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')
const source = read('client/src/infrastructure/game/remoteGameRoomPort.ts')
const remote = await importTypeScriptModule(source)

async function testRoomSnapshotNormalizesServerContract({ createRemoteGameRoomPort }) {
  const calls = []
  const port = createRemoteGameRoomPort({
    baseUrl: 'http://api.test',
    fetcher: createFetch(calls, {
      'GET /api/rooms/room-flow': {
        room: createRoomResponse('room-flow', 'racing'),
        players: [
          {
            user_id: 'user-a',
            nickname: '릴레이러',
            is_host: true,
            is_ready: true,
            validation_cleared: true,
            race_progress: 80,
            race_finished_at_ms: null,
            race_distance_to_goal: 20,
          },
        ],
      },
    }),
  })

  const result = await port.getRoomSnapshot(session, 'room-flow', 'remote')

  assert.equal(result.ok, true)
  assert.equal(result.value.roomId, 'room-flow')
  assert.equal(result.value.phase, 'racing')
  assert.equal(result.value.phaseEndsAt, '2026-07-14T00:10:00.000Z')
  assert.deepEqual(result.value.players[0], {
    userId: 'user-a',
    nickname: '릴레이러',
    isHost: true,
    isReady: true,
    validationCleared: true,
    raceProgress: 80,
    raceFinishedAtMs: null,
    raceDistanceToGoal: 20,
  })
  assert.equal(calls[0].url, 'http://api.test/api/rooms/room-flow')
  assert.equal(calls[0].headers.Authorization, `Bearer ${session.token}`)
}

async function testGamePhaseActionsSendServerContract({ createRemoteGameRoomPort }) {
  const calls = []
  const port = createRemoteGameRoomPort({
    baseUrl: 'http://api.test',
    fetcher: createFetch(calls, {
      'POST /api/rooms/room-flow/segments': {
        segment: createSegmentResponse('segment-flow', false),
        room: createRoomResponse('room-flow', 'validating'),
      },
      'POST /api/rooms/room-flow/segments/validate': {
        segment: createSegmentResponse('segment-flow', true),
        room: createRoomResponse('room-flow', 'merging'),
      },
      'POST /api/rooms/room-flow/race/finish': {
        result: createRaceResultResponse('room-flow'),
        room: createRoomResponse('room-flow', 'finished', null),
      },
    }),
  })

  const segmentResult = await port.saveMapSegment(
    session,
    {
      roomId: 'room-flow',
      creatorId: session.id,
      startPoint: { x: 1, y: 7 },
      endPoint: { x: 22, y: 7 },
      placements: [
        {
          id: 'placement-flow',
          x: 4,
          y: 7,
          asset: createAsset('platform-flow'),
        },
      ],
    },
    'remote',
  )

  assert.equal(segmentResult.ok, true)
  assert.equal(segmentResult.value.id, 'segment-flow')
  assert.equal(segmentResult.value.roomPhase, 'validating')

  const saveBody = JSON.parse(calls[0].init.body)
  assert.deepEqual(saveBody.start_point, { x: 1, y: 7 })
  assert.deepEqual(saveBody.end_point, { x: 22, y: 7 })
  assert.equal(saveBody.assets[0].assetId, 'platform-flow')
  assert.equal(saveBody.assets[0].widthCells, 2)

  const validationResult = await port.validateMapSegment(
    session,
    {
      roomId: 'room-flow',
      userId: session.id,
      segmentHash: 'hash-flow',
      cleared: true,
      clearTimeMs: 61_400,
    },
    'remote',
  )

  assert.equal(validationResult.ok, true)
  assert.equal(validationResult.value.isValidated, true)
  assert.equal(validationResult.value.roomPhase, 'merging')

  const validateBody = JSON.parse(calls[1].init.body)
  assert.deepEqual(validateBody, {
    user_id: session.id,
    segment_hash: 'hash-flow',
    cleared: true,
    clear_time_ms: 61_400,
  })

  const raceFinishResult = await port.finishRace(
    session,
    {
      roomId: 'room-flow',
      userId: session.id,
      finishTimeMs: 73_400,
    },
    'remote',
  )

  assert.equal(raceFinishResult.ok, true)
  assert.equal(raceFinishResult.value.roomPhase, 'finished')
  assert.equal(raceFinishResult.value.players[0].raceFinishedAtMs, 73_400)

  const finishBody = JSON.parse(calls[2].init.body)
  assert.deepEqual(finishBody, {
    user_id: session.id,
    finish_time_ms: 73_400,
  })
}

async function testResultNotReadyDoesNotFallback({ createRemoteGameRoomPort }) {
  const port = createRemoteGameRoomPort({
    baseUrl: 'http://api.test',
    fetcher: createFetch([], {
      'GET /api/rooms/room-flow/results': {
        status: 404,
        body: {
          error: {
            code: 'RESULT_NOT_READY',
            message: '아직 레이스 결과가 없어요.',
          },
        },
      },
    }),
  })

  const result = await port.getRaceResults(session, 'room-flow', 'remote')

  assert.equal(result.ok, false)
  assert.equal(result.error.kind, 'not_found')
  assert.equal(result.error.message, '아직 레이스 결과가 없어요.')
}

const session = {
  id: 'user-a',
  nickname: '릴레이러',
  token: 'token-a',
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

function createSegmentResponse(segmentId, isValidated) {
  return {
    id: segmentId,
    room_id: 'room-flow',
    creator_id: 'user-a',
    start_point: { x: 1, y: 7 },
    end_point: { x: 22, y: 7 },
    placements: [
      {
        id: 'placement-flow',
        x: 4,
        y: 7,
        asset: createAsset('platform-flow'),
      },
    ],
    assets: [
      {
        asset_id: 'platform-flow',
        asset_category: 'platform',
        asset_attrs: {},
        collider_type: 'rect',
        x: 4,
        y: 7,
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

function createRaceResultResponse(roomId) {
  return {
    room_id: roomId,
    players: [
      {
        user_id: 'user-a',
        nickname: '릴레이러',
        is_host: true,
        validation_cleared: true,
        race_progress: 100,
        race_finished_at_ms: 73_400,
        race_distance_to_goal: 0,
        rank: 1,
      },
    ],
  }
}

function createAsset(assetId) {
  return {
    id: assetId,
    creatorId: null,
    creator_id: null,
    isSystem: true,
    is_system: true,
    category: 'platform',
    name: '발판',
    description: '',
    attrs: {},
    colliderType: 'rect',
    collider_type: 'rect',
    widthCells: 2,
    width_cells: 2,
    heightCells: 1,
    height_cells: 1,
    sourceImageUrl: '',
    source_image_url: '',
    remixOfId: null,
    remix_of_id: null,
    status: 'ready',
    isPublic: true,
    is_public: true,
    createdAt: '2026-07-14T00:00:00.000Z',
    created_at: '2026-07-14T00:00:00.000Z',
    sprites: [],
  }
}

await testRoomSnapshotNormalizesServerContract(remote)
await testGamePhaseActionsSendServerContract(remote)
await testResultNotReadyDoesNotFallback(remote)

assert.doesNotMatch(source, /createMock|Mock fallback|relay\.mock/i)

console.log('remote game room port contract self-test passed')

async function importTypeScriptModule(tsSource) {
  const output = transpileTypeScript(inlineDiagnosticsImport(tsSource))
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
