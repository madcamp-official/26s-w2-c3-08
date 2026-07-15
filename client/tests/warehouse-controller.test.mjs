import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')

const coreSource = read('client/src/pages/warehouse/warehouseControllerCore.ts')
const hookSource = read('client/src/pages/warehouse/useWarehouseController.ts')
const controllerSource = read('client/src/pages/warehouse/WarehouseController.tsx')
const screenSource = read('client/src/pages/warehouse/WarehouseScreen.tsx')
const modalSource = read('client/src/design-system/components/Modal/Modal.tsx')
const mockAssetSource = read('client/src/infrastructure/warehouse/mockWarehouseAssetPort.ts')
const remoteAssetSource = read('client/src/infrastructure/warehouse/remoteWarehouseAssetPort.ts')
const localUpdatesSource = read('client/src/infrastructure/warehouse/localAssetJobUpdates.ts')
const remoteUpdatesSource = read('client/src/infrastructure/warehouse/remoteAssetJobUpdates.ts')
const routerSource = read('client/src/app/navigation/prototypeRouter.ts')
const appSource = read('client/src/app/AppV2.tsx')

const core = await importTypeScriptModule(coreSource)

await testStatusMapping(core)
await testCooldown(core)
await testReadyOnlyActions(core)
await testFailedRetryAndActionRegeneration(core)
await testReconnect(core)
await testRouteToStudio(core)
await testAiTraceMapping(core)

assert.equal(statSync(join(repoRoot, 'client/src/pages/warehouse/WarehouseController.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/pages/warehouse/useWarehouseController.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/warehouse/mockWarehouseAssetPort.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/warehouse/remoteWarehouseAssetPort.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/warehouse/localAssetJobUpdates.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/warehouse/remoteAssetJobUpdates.ts')).isFile(), true)

assert.match(coreSource, /export interface WarehouseAssetPort/)
assert.match(coreSource, /export interface AssetJobUpdates/)
assert.match(coreSource, /export const WAREHOUSE_REGEN_COOLDOWN_MS = 5 \* 60 \* 1000/)
assert.match(coreSource, /listAssets/)
assert.match(coreSource, /equipAvatar/)
assert.match(coreSource, /retryAsset/)
assert.match(coreSource, /regenerateAction/)
assert.match(coreSource, /mapWarehouseAssetsToViewModels/)
assert.match(coreSource, /sourceImageUrl/)
assert.match(coreSource, /handleWarehouseAssetJobEvent/)
assert.match(coreSource, /handleWarehouseConnectionEvent/)
assert.match(coreSource, /tickWarehouseCooldown/)

assert.match(hookSource, /bootWarehouseController/)
assert.match(hookSource, /assetJobUpdates\.subscribe/)
assert.match(hookSource, /tickWarehouseCooldown/)
assert.match(hookSource, /loadWarehouseAssets/)
assert.match(controllerSource, /resolveV2ModeConfig/)
assert.match(controllerSource, /createMockWarehouseAssetPort/)
assert.match(controllerSource, /createRemoteWarehouseAssetPort/)
assert.match(controllerSource, /createLocalAssetJobUpdates/)
assert.match(controllerSource, /createRemoteAssetJobUpdates/)
assert.match(controllerSource, /setPrototypeRoute\('avatar-studio'/)
assert.match(controllerSource, /setPrototypeRoute\('asset-studio'/)
assert.match(controllerSource, /data-v2-data-mode=\{resolvedDependencies\.dataMode\}/)
assert.match(controllerSource, /data-v2-realtime-mode=\{modeConfig\.realtimeMode\}/)

assert.match(mockAssetSource, /relay\.mock\.assets/)
assert.match(mockAssetSource, /schemaVersion: 'mock-warehouse-assets-v1'/)
assert.match(mockAssetSource, /createMockWarehouseAssetPort/)
assert.match(remoteAssetSource, /\/api\/assets\?user_id=/)
assert.match(remoteAssetSource, /source_image_url/)
assert.match(remoteAssetSource, /readString\(asset\.image\)/)
assert.match(remoteAssetSource, /\/equip-avatar/)
assert.match(remoteAssetSource, /\/retry/)
assert.match(remoteAssetSource, /\/sprites\/\$\{encodeURIComponent\(action\)\}\/regenerate/)
assert.match(remoteAssetSource, /Authorization: `Bearer \$\{session\.token\}`/)
assert.match(remoteAssetSource, /createRemoteWarehouseAssetPort/)
assert.doesNotMatch(remoteAssetSource, /API 계약이 아직 확정되지 않았어요/)
assert.doesNotMatch(remoteAssetSource, /createMock|Mock fallback/i)
assert.match(localUpdatesSource, /createLocalAssetJobUpdates/)
assert.match(remoteUpdatesSource, /createRemoteAssetJobUpdates/)
assert.match(remoteUpdatesSource, /\/api\/asset-jobs\?user_id=/)
assert.match(remoteUpdatesSource, /maxPollMs = 2 \* 60 \* 1_000/)
assert.match(remoteUpdatesSource, /startAssetJobPolling/)
assert.doesNotMatch(remoteUpdatesSource, /BroadcastChannel|@colyseus/i)

assert.match(routerSource, /kind: 'avatarStudio'/)
assert.match(routerSource, /path: 'avatar-studio'/)
assert.match(routerSource, /sourceAssetId/)
assert.match(routerSource, /normalizeStudioMode/)
assert.match(appSource, /case 'warehouse':/)
assert.match(appSource, /<WarehouseController/)
assert.match(appSource, /case 'avatarStudio':/)
assert.match(appSource, /<AvatarStudioController routeState=\{route\.contractRoute\} \/>/)
assert.doesNotMatch(appSource, /A Avatar Studio placeholder/)
assert.doesNotMatch(appSource, /getWarehouseScreenFixtureForRoute/)

assert.match(screenSource, /<Modal/)
assert.match(modalSource, /restoreFocusRef/)
assert.match(modalSource, /event\.key === 'Escape'/)
assert.match(modalSource, /getFocusableElements/)
assert.match(screenSource, /getConnectionBadgeState/)
assert.doesNotMatch(
  screenSource,
  /SessionPort|StoragePort|WarehouseAssetPort|AssetJobUpdates|resolveV2ModeConfig|localStorage|\/api\/|createMock|createRemote/i,
)

console.log('warehouse controller contract self-test passed')

async function testStatusMapping({
  mapWarehouseAssetsToViewModels,
}) {
  const nowMs = Date.parse('2026-07-14T00:00:00.000Z')
  const session = createSession()
  const viewModels = mapWarehouseAssetsToViewModels(
    [
      createAsset({ id: 'queued-platform', category: 'platform', status: 'queued' }),
      createAsset({ id: 'generating-background', category: 'background', status: 'generating' }),
      createAsset({ id: 'ready-monster', category: 'monster', status: 'ready' }),
      createAsset({ id: 'failed-obstacle', category: 'obstacle', status: 'failed' }),
      createAsset({ id: 'excluded-item', category: 'item', status: 'ready' }),
    ],
    session,
    nowMs,
  )

  assert.deepEqual(viewModels.map((asset) => asset.id), [
    'queued-platform',
    'generating-background',
    'ready-monster',
    'failed-obstacle',
  ])
  assert.deepEqual(viewModels.map((asset) => asset.status), [
    'queued',
    'generating',
    'ready',
    'failed',
  ])
  assert.equal(viewModels[0].statusText, '대기 중')
  assert.equal(viewModels[1].progress, 48)
  assert.equal(viewModels[2].actions[0].status, 'available')
  assert.equal(viewModels[3].errorText, '에셋 생성에 실패했어요. 다시 시도할 수 있어요.')
}

async function testCooldown({
  regenerateWarehouseAction,
  mapWarehouseAssetsToViewModels,
}) {
  const nowMs = Date.parse('2026-07-14T00:00:00.000Z')
  const asset = createAsset({
    id: 'ready-platform',
    category: 'platform',
    status: 'ready',
    sprites: [
      {
        action: 'static',
        status: 'ready',
        lastRegenAt: new Date(nowMs - 60 * 1000).toISOString(),
      },
    ],
  })
  const runtime = createRuntime({ assets: [asset], nowMs })
  const viewModels = mapWarehouseAssetsToViewModels(runtime.state.assets, runtime.state.session, nowMs)

  assert.equal(viewModels[0].actions[0].status, 'cooling_down')
  assert.equal(viewModels[0].actions[0].cooldownText, '04:00')

  const result = await regenerateWarehouseAction(runtime, 'ready-platform', 'static')

  assert.equal(result.reason, 'cooldown')
  assert.equal(runtime.calls.regenerateAction, 0)
}

async function testReadyOnlyActions({ equipWarehouseAvatar }) {
  const queuedAvatar = createAsset({
    id: 'queued-avatar',
    category: 'avatar',
    status: 'queued',
    sprites: [
      { action: 'idle', status: 'queued', lastRegenAt: null },
      { action: 'walk', status: 'queued', lastRegenAt: null },
      { action: 'onair', status: 'queued', lastRegenAt: null },
    ],
  })
  const readyAvatar = createAsset({
    id: 'ready-avatar',
    category: 'avatar',
    status: 'ready',
    sprites: [
      { action: 'idle', status: 'ready', lastRegenAt: null },
      { action: 'walk', status: 'ready', lastRegenAt: null },
      { action: 'onair', status: 'ready', lastRegenAt: null },
    ],
  })
  const runtime = createRuntime({ assets: [queuedAvatar, readyAvatar] })
  const queuedResult = await equipWarehouseAvatar(runtime, 'queued-avatar')

  assert.equal(queuedResult.reason, 'not_ready')
  assert.equal(runtime.calls.equipAvatar, 0)

  const readyResult = await equipWarehouseAvatar(runtime, 'ready-avatar')

  assert.equal(readyResult.ok, true)
  assert.equal(runtime.calls.equipAvatar, 1)
  assert.equal(runtime.savedSession.avatarAssetId, 'ready-avatar')
  assert.equal(runtime.state.session.avatarAssetId, 'ready-avatar')
}

async function testFailedRetryAndActionRegeneration({
  retryWarehouseAsset,
  regenerateWarehouseAction,
}) {
  const failedAsset = createAsset({
    id: 'failed-obstacle',
    category: 'obstacle',
    status: 'failed',
    sprites: [{ action: 'static', status: 'failed', lastRegenAt: null }],
  })
  const readyAsset = createAsset({
    id: 'ready-platform',
    category: 'platform',
    status: 'ready',
    sprites: [{ action: 'static', status: 'ready', lastRegenAt: null }],
  })
  const runtime = createRuntime({ assets: [failedAsset, readyAsset] })

  const retryResult = await retryWarehouseAsset(runtime, 'failed-obstacle')
  const regenerationResult = await regenerateWarehouseAction(runtime, 'ready-platform', 'static')

  assert.equal(retryResult.ok, true)
  assert.equal(regenerationResult.ok, true)
  assert.equal(runtime.calls.retryAsset, 1)
  assert.equal(runtime.calls.regenerateAction, 1)
  assert.equal(runtime.state.assets.find((asset) => asset.id === 'failed-obstacle').status, 'generating')
  assert.equal(runtime.state.assets.find((asset) => asset.id === 'ready-platform').status, 'generating')
}

async function testReconnect({ handleWarehouseConnectionEvent }) {
  const runtime = createRuntime()

  runtime.state.connectionStatus = 'reconnecting'

  const result = handleWarehouseConnectionEvent(runtime, { status: 'online' })

  assert.equal(result.shouldRefresh, true)
  assert.equal(runtime.state.connectionStatus, 'online')
}

async function testRouteToStudio({ editWarehouseAssetSource }) {
  const runtime = createRuntime({
    assets: [
      createAsset({ id: 'ready-avatar', category: 'avatar', status: 'ready' }),
      createAsset({ id: 'ready-platform', category: 'platform', status: 'ready' }),
    ],
  })

  const avatarResult = editWarehouseAssetSource(runtime, 'ready-avatar')
  const platformResult = editWarehouseAssetSource(runtime, 'ready-platform')

  assert.equal(avatarResult.ok, true)
  assert.equal(platformResult.ok, true)
  assert.deepEqual(runtime.routeChanges, [
    ['avatar-studio', 'ready-avatar'],
    ['asset-studio', 'ready-platform'],
  ])
}

async function testAiTraceMapping({
  handleWarehouseAssetJobEvent,
  mapWarehouseAssetsToViewModels,
}) {
  const nowMs = Date.parse('2026-07-14T00:00:00.000Z')
  const qwenWanTrace = [
    {
      stage: 'qwen',
      status: 'success',
      code: 'QWEN_OK',
      message: 'Qwen LLM이 WAN 프롬프트를 정리했어요.',
      responseSummary: '{"wan_prompt":"green platform sprite"}',
    },
    {
      stage: 'wan',
      status: 'failed',
      code: 'WAN_TIMEOUT',
      message: 'WAN 모델 응답 시간이 초과됐어요.',
      responseSummary: '{"timeout_ms":90000}',
    },
  ]
  const asset = createAsset({
    id: 'trace-platform',
    category: 'platform',
    status: 'failed',
    aiTrace: qwenWanTrace,
    errorCode: 'WAN_TIMEOUT',
    errorMessage: 'WAN 모델 응답 시간이 초과됐어요.',
    sprites: [
      {
        action: 'static',
        status: 'failed',
        lastRegenAt: null,
        aiTrace: qwenWanTrace,
        errorCode: 'WAN_TIMEOUT',
        errorMessage: 'WAN 모델 응답 시간이 초과됐어요.',
      },
    ],
  })
  const runtime = createRuntime({ assets: [asset], nowMs })

  const viewModels = mapWarehouseAssetsToViewModels(runtime.state.assets, runtime.state.session, nowMs)

  assert.deepEqual(viewModels[0].aiTrace, qwenWanTrace)
  assert.deepEqual(viewModels[0].actions[0].aiTrace, qwenWanTrace)
  assert.equal(viewModels[0].errorText, 'WAN 모델 응답 시간이 초과됐어요. 오류 코드: WAN_TIMEOUT')
  assert.equal(viewModels[0].actions[0].errorText, 'WAN 모델 응답 시간이 초과됐어요. 오류 코드: WAN_TIMEOUT')

  const recoveryTrace = [
    ...qwenWanTrace,
    {
      stage: 'storage',
      status: 'success',
      code: 'STORAGE_OK',
      message: '생성 이미지를 저장했어요.',
      responseSummary: '{"url":"https://assets.example/generated.png"}',
    },
  ]

  handleWarehouseAssetJobEvent(runtime, {
    assetId: 'trace-platform',
    status: 'ready',
    action: 'static',
    aiTrace: recoveryTrace,
    updatedAtMs: nowMs + 1_000,
  })

  assert.equal(runtime.state.assets[0].status, 'ready')
  assert.deepEqual(runtime.state.assets[0].sprites[0].aiTrace, recoveryTrace)
  assert.deepEqual(runtime.state.assets[0].aiTrace, qwenWanTrace)
}

function createRuntime(options = {}) {
  const session = options.session ?? createSession()
  const nowMs = options.nowMs ?? Date.parse('2026-07-14T00:00:00.000Z')
  const runtime = {
    dataMode: options.dataMode ?? 'mock',
    state: {
      ...core.createInitialWarehouseControllerState('component', 'all', nowMs),
      session,
      assets: options.assets ?? [],
      nowMs,
    },
    calls: {
      listAssets: 0,
      equipAvatar: 0,
      retryAsset: 0,
      regenerateAction: 0,
    },
    routeChanges: [],
    savedSession: null,
    sessionStoragePort: {
      loadSession() {
        return session
      },
      saveSession(nextSession) {
        runtime.savedSession = nextSession
      },
      clearSession() {
        runtime.savedSession = null
      },
    },
    assetPort: {
      async listAssets() {
        runtime.calls.listAssets += 1
        return options.listAssetsResult ?? { ok: true, value: runtime.state.assets }
      },
      async equipAvatar(currentSession, assetId) {
        runtime.calls.equipAvatar += 1
        return options.equipResult ?? {
          ok: true,
          value: {
            ...currentSession,
            avatarAssetId: assetId,
          },
        }
      },
      async retryAsset(_currentSession, assetId) {
        runtime.calls.retryAsset += 1
        const asset = runtime.state.assets.find((item) => item.id === assetId)

        return options.retryResult ?? { ok: true, value: { ...asset, status: 'generating' } }
      },
      async regenerateAction(_currentSession, assetId, action) {
        runtime.calls.regenerateAction += 1
        const asset = runtime.state.assets.find((item) => item.id === assetId)

        return options.regenerateResult ?? {
          ok: true,
          value: {
            ...asset,
            status: 'generating',
            sprites: asset.sprites.map((sprite) =>
              sprite.action === action ? { ...sprite, status: 'queued' } : sprite,
            ),
          },
        }
      },
    },
    assetJobUpdates: {
      getConnectionStatus() {
        return { status: 'online' }
      },
      subscribe() {
        return () => undefined
      },
    },
    routePort: {
      navigateLogin() {
        runtime.routeChanges.push(['login'])
      },
      navigateMain() {
        runtime.routeChanges.push(['main'])
      },
      navigateWarehouse(tab, filter) {
        runtime.routeChanges.push(['warehouse', tab, filter])
      },
      navigateAvatarStudio(assetId) {
        runtime.routeChanges.push(['avatar-studio', assetId])
      },
      navigateAssetStudio(assetId) {
        runtime.routeChanges.push(['asset-studio', assetId])
      },
    },
    getNowMs() {
      return runtime.state.nowMs
    },
    getState() {
      return runtime.state
    },
    setState(updater) {
      runtime.state = updater(runtime.state)
    },
  }

  return runtime
}

function createAsset(overrides = {}) {
  const category = overrides.category ?? 'platform'
  const status = overrides.status ?? 'ready'

  return {
    id: overrides.id ?? 'asset-ready',
    creatorId: overrides.creatorId ?? 'mock-user-relay',
    isSystem: overrides.isSystem ?? false,
    category,
    name: overrides.name ?? '테스트 에셋',
    description: overrides.description ?? '테스트 설명',
    status,
    createdAt: overrides.createdAt ?? '2026-07-13T00:00:00.000Z',
    widthCells: overrides.widthCells ?? (category === 'avatar' ? null : 2),
    heightCells: overrides.heightCells ?? (category === 'avatar' ? null : 1),
    errorCode: overrides.errorCode ?? null,
    errorMessage: overrides.errorMessage ?? null,
    aiTrace: overrides.aiTrace,
    sprites: overrides.sprites ?? [
      {
        action: category === 'avatar' ? 'idle' : 'static',
        status,
        lastRegenAt: null,
      },
    ],
  }
}

function createSession() {
  return {
    id: 'mock-user-relay',
    nickname: '릴레이러',
    token: 'mock-token-relay',
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
