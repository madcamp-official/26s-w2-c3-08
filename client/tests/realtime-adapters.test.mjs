import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')

const transportSource = read('client/src/infrastructure/realtime/socketIoTransport.ts')
const socketFactorySource = read('client/src/infrastructure/realtime/socketIoClientFactory.ts')
const remoteSource = read('client/src/infrastructure/realtime/socketIoRemoteAdapters.ts')
const localSource = read('client/src/infrastructure/realtime/broadcastChannelLocalAdapters.ts')
const factorySource = read('client/src/infrastructure/realtime/realtimeAdapters.ts')
const warehouseRemoteSource = read('client/src/infrastructure/warehouse/remoteAssetJobUpdates.ts')
const modeConfigSource = read('client/src/infrastructure/config/modeConfig.ts')
const sharedSchemasSource = read('shared/schemas/index.ts')
const packageSource = read('client/package.json')

const transport = await importTypeScriptModule(transportSource)

await testMissingSocketClientReportsError(transport)
await testSocketStatusMapping(transport)
await testSocketEventsStayInAdapterSources()

assert.match(packageSource, /socket\.io-client/)
assert.match(socketFactorySource, /from 'socket\.io-client'/)
assert.match(socketFactorySource, /createProductionSocketIoClient/)
assert.match(transportSource, /SocketIoClientFactory/)
assert.match(transportSource, /SOCKET_IO_CLIENT_MISSING/)
assert.match(transportSource, /'connecting'/)
assert.match(transportSource, /'connected'/)
assert.match(transportSource, /'reconnecting'/)
assert.match(transportSource, /'offline'/)
assert.match(transportSource, /'error'/)
assert.match(transportSource, /transports: \['websocket', 'polling'\]/)
assert.match(remoteSource, /room:join/)
assert.match(remoteSource, /room:start/)
assert.match(remoteSource, /phase:ready/)
assert.match(remoteSource, /time_vote:request/)
assert.match(remoteSource, /segment:submitted/)
assert.match(remoteSource, /validation:completed/)
assert.match(remoteSource, /race:position/)
assert.match(remoteSource, /race:finish/)
assert.match(remoteSource, /asset_job:updated/)
assert.match(remoteSource, /createProductionSocketIoClient/)
assert.match(remoteSource, /roomStateSnapshotSchema/)
assert.match(remoteSource, /racePositionPayloadSchema/)
assert.match(remoteSource, /resultsFinalPayloadSchema/)
assert.match(localSource, /BroadcastChannel/)
assert.match(localSource, /relay\.v2\.realtime\.local/)
assert.match(factorySource, /realtimeMode === 'remote'/)
assert.match(factorySource, /createSocketIoRemoteRealtimeAdapters/)
assert.match(factorySource, /createBroadcastChannelRealtimeAdapters/)
assert.match(modeConfigSource, /allowLocalRealtimeFallback: false/)
assert.match(warehouseRemoteSource, /createSocketIoRemoteRealtimeAdapters/)
assert.match(warehouseRemoteSource, /server_unavailable/)
assert.match(sharedSchemasSource, /'error'/)
assert.match(sharedSchemasSource, /isFinishCountdown/)
assert.doesNotMatch(remoteSource + warehouseRemoteSource, /BroadcastChannel|@colyseus|Client from '@colyseus/)

console.log('realtime adapter contract self-test passed')

async function testMissingSocketClientReportsError({ createSocketIoTransport }) {
  const statusChanges = []
  const realtime = createSocketIoTransport()
  realtime.onStatusChange((status) => statusChanges.push(status))

  const result = await realtime.connect({
    id: 'user-1',
    nickname: '릴레이러',
    token: 'token',
    avatarAssetId: null,
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'SOCKET_IO_CLIENT_MISSING')
  assert.equal(result.error.source, 'realtime')
  assert.equal(realtime.getStatus(), 'error')
  assert.deepEqual(statusChanges, ['error'])
}

async function testSocketStatusMapping({ createSocketIoTransport }) {
  const fakeSocket = createFakeSocket()
  const factoryCalls = []
  const statuses = []
  const realtime = createSocketIoTransport({
    url: 'http://socket.example',
    socketFactory(url, options) {
      factoryCalls.push([url, options])
      return fakeSocket
    },
  })
  realtime.onStatusChange((status) => statuses.push(status))

  const result = await realtime.connect({
    id: 'user-2',
    nickname: '소켓러',
    token: 'token-2',
    avatarAssetId: null,
  })

  assert.equal(result.ok, true)
  assert.equal(factoryCalls[0][0], 'http://socket.example')
  assert.deepEqual(factoryCalls[0][1].auth, { userId: 'user-2', token: 'token-2' })
  assert.equal(fakeSocket.connectCalls, 1)
  assert.equal(statuses[0], 'connecting')

  fakeSocket.emitLocal('connect')
  fakeSocket.emitManager('reconnect_attempt')
  fakeSocket.emitManager('reconnect')
  fakeSocket.emitLocal('connect_error')

  assert.deepEqual(statuses, ['connecting', 'connected', 'reconnecting', 'connected', 'error'])
}

async function testSocketEventsStayInAdapterSources() {
  const uiSources = [
    read('client/src/pages/login/LoginScreen.tsx'),
    read('client/src/pages/main/MainScreen.tsx'),
    read('client/src/pages/warehouse/WarehouseScreen.tsx'),
    read('client/src/pages/asset-studio/AssetStudioScreen.tsx'),
  ].join('\n')

  for (const eventName of [
    'room:join',
    'room:start',
    'phase:ready',
    'time_vote:request',
    'segment:submitted',
    'validation:completed',
    'race:position',
    'race:finish',
    'asset_job:updated',
  ]) {
    assert.doesNotMatch(uiSources, new RegExp(escapeRegExp(eventName)), `${eventName} leaked into UI`)
  }
}

function createFakeSocket() {
  const listeners = new Map()
  const managerListeners = new Map()

  return {
    connectCalls: 0,
    connected: false,
    io: {
      on(eventName, listener) {
        addListener(managerListeners, eventName, listener)
      },
      off(eventName, listener) {
        removeListener(managerListeners, eventName, listener)
      },
    },
    on(eventName, listener) {
      addListener(listeners, eventName, listener)
    },
    off(eventName, listener) {
      removeListener(listeners, eventName, listener)
    },
    emit() {
      return undefined
    },
    connect() {
      this.connectCalls += 1
    },
    disconnect() {
      this.connected = false
    },
    emitLocal(eventName, payload) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener(payload)
      }
    },
    emitManager(eventName, payload) {
      for (const listener of managerListeners.get(eventName) ?? []) {
        listener(payload)
      }
    },
  }
}

function addListener(map, eventName, listener) {
  const listeners = map.get(eventName) ?? new Set()
  listeners.add(listener)
  map.set(eventName, listeners)
}

function removeListener(map, eventName, listener) {
  map.get(eventName)?.delete(listener)
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
