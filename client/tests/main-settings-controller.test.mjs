import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')
const coreSource = read('client/src/pages/main/mainControllerCore.ts')
const controllerSource = read('client/src/pages/main/MainController.tsx')
const hookSource = read('client/src/pages/main/useMainController.ts')
const screenSource = read('client/src/pages/main/MainScreen.tsx')
const modalSource = read('client/src/design-system/components/Modal/Modal.tsx')
const settingsStorageSource = read('client/src/infrastructure/settings/browserSettingsStoragePort.ts')
const mockAssetSource = read('client/src/infrastructure/main/mockAssetPort.ts')
const remoteAssetSource = read('client/src/infrastructure/main/remoteAssetPort.ts')
const mockSessionSource = read('client/src/infrastructure/settings/mockMainSessionPort.ts')
const remoteSessionSource = read('client/src/infrastructure/settings/remoteMainSessionPort.ts')
const mockDeviceSource = read('client/src/infrastructure/settings/mockDeviceLinkPort.ts')
const remoteDeviceSource = read('client/src/infrastructure/settings/remoteDeviceLinkPort.ts')
const routerSource = read('client/src/app/navigation/prototypeRouter.ts')
const appSource = read('client/src/app/AppV2.tsx')

const core = await importTypeScriptModule(coreSource)

await testNavigationCallbacks(core)
await testSettingsPersistence(core)
await testNicknameValidation(core)
await testInvalidCode(core)
await testExpiredCode(core)
await testRemoteErrorNoFallback(core)
await testBootReadsAssets(core)

assert.match(coreSource, /export interface AssetPort/)
assert.match(coreSource, /export interface MainSessionPort/)
assert.match(coreSource, /export interface SettingsStoragePort/)
assert.match(coreSource, /export interface SettingsController/)
assert.match(coreSource, /createMainScreenCallbacks/)
assert.match(coreSource, /createSettingsController/)
assert.match(coreSource, /navigateLobby/)
assert.match(coreSource, /navigateAssetStudio/)
assert.match(coreSource, /navigateWarehouse\(tab/)
assert.match(coreSource, /clampVolume/)
assert.match(coreSource, /mapDeviceErrorToSettingsState/)
assert.match(hookSource, /bootMainController/)
assert.match(hookSource, /createMainScreenProps/)
assert.match(controllerSource, /useMemo<MainControllerDependencies>/)
assert.match(controllerSource, /resolveV2ModeConfig/)
assert.match(controllerSource, /createBrowserSessionStoragePort/)
assert.match(controllerSource, /createBrowserSettingsStoragePort/)
assert.match(controllerSource, /createMockAssetPort/)
assert.match(controllerSource, /createRemoteAssetPort/)
assert.match(controllerSource, /createMockDeviceLinkPort/)
assert.match(controllerSource, /createRemoteDeviceLinkPort/)
assert.match(controllerSource, /setPrototypeRoute\('lobby'\)/)
assert.match(controllerSource, /setPrototypeRoute\('asset-studio'\)/)
assert.match(controllerSource, /navigateWarehouse/)
assert.match(controllerSource, /data-v2-data-mode=\{resolvedDependencies\.dataMode\}/)

assert.match(settingsStorageSource, /relay\.settings/)
assert.match(settingsStorageSource, /schemaVersion: 'settings-v1'/)
assert.match(mockAssetSource, /createMockAssetPort/)
assert.match(remoteAssetSource, /\/api\/assets/)
assert.match(remoteAssetSource, /creator_id/)
assert.match(remoteAssetSource, /source_image_url/)
assert.match(remoteAssetSource, /session\.avatarAssetId/)
assert.match(remoteAssetSource, /mainState: 'avatarGenerating'/)
assert.match(remoteAssetSource, /mainState: 'avatarFailed'/)
assert.match(remoteAssetSource, /findLatestAvatarByStatus/)
assert.match(remoteAssetSource, /readAvatarSourceImageUrl\(workingAvatarAsset\)/)
assert.match(remoteAssetSource, /readAvatarSourceImageUrl\(failedAvatarAsset\)/)
assert.match(mockSessionSource, /createMockMainSessionPort/)
assert.match(remoteSessionSource, /\/api\/session\/nickname/)
assert.match(mockDeviceSource, /TIGER-3392/)
assert.match(mockDeviceSource, /EXPIRED-0000/)
assert.match(remoteDeviceSource, /\/api\/device-link-codes/)
assert.doesNotMatch(remoteAssetSource + remoteSessionSource + remoteDeviceSource, /createMock|Mock fallback/i)

assert.match(routerSource, /kind: 'lobby'/)
assert.match(routerSource, /screenId: 'S3_LOBBY'/)
assert.match(routerSource, /kind: 'assetStudio'/)
assert.match(routerSource, /screenId: 'B_ASSET_STUDIO'/)
assert.match(routerSource, /createWarehouseContractRoute/)
assert.match(routerSource, /query\.tab === 'avatar'/)
assert.match(appSource, /case 'main':/)
assert.match(appSource, /<MainController \/>/)
assert.match(appSource, /case 'lobby':/)
assert.match(appSource, /<LobbyController \/>/)
assert.match(appSource, /case 'assetStudio':/)
assert.match(appSource, /<AssetStudioController routeState=\{route\.contractRoute\} \/>/)

assert.match(screenSource, /<Modal/)
assert.match(screenSource, /onClose=\{onClose\}/)
assert.match(screenSource, /aria-label="설정 열기"/)
assert.match(screenSource, /onClick=\{onOpenSettings\}/)
assert.match(modalSource, /restoreFocusRef/)
assert.match(modalSource, /event\.key === 'Escape'/)
assert.match(modalSource, /getFocusableElements/)
assert.match(modalSource, /document\.body\.style\.overflow = 'hidden'/)

assert.doesNotMatch(
  screenSource,
  /SessionPort|StoragePort|AssetPort|DeviceLinkPort|resolveV2(?:DataMode|ModeConfig)|localStorage|\/api\/|createMock|createRemote/i,
)

console.log('main/settings controller contract self-test passed')

async function testNavigationCallbacks({
  createMainScreenCallbacks,
  createInitialMainControllerState,
}) {
  const runtime = createRuntime(createInitialMainControllerState)
  const callbacks = createMainScreenCallbacks(runtime)

  callbacks.onNavigateLobby()
  callbacks.onOpenAssetStudio()
  callbacks.onOpenWarehouse('avatar')
  callbacks.onOpenWarehouse('component')

  assert.deepEqual(runtime.routeChanges, [
    ['lobby'],
    ['asset-studio'],
    ['warehouse', 'avatar'],
    ['warehouse', 'component'],
  ])
}

async function testSettingsPersistence({
  createMainScreenCallbacks,
  createInitialMainControllerState,
}) {
  const runtime = createRuntime(createInitialMainControllerState)
  const callbacks = createMainScreenCallbacks(runtime)

  callbacks.onChangeBgmVolume(140)
  callbacks.onChangeSfxVolume(-3)
  callbacks.onToggleMute(true)

  assert.equal(runtime.state.settingsValues.bgmVolume, 100)
  assert.equal(runtime.state.settingsValues.sfxVolume, 0)
  assert.equal(runtime.state.settingsValues.muted, true)
  assert.equal(runtime.savedSettings.length, 3)
  assert.equal(runtime.savedSettings.at(-1).muted, true)
}

async function testNicknameValidation({ saveNickname, createInitialMainControllerState }) {
  const runtime = createRuntime(createInitialMainControllerState)

  const emptyResult = await saveNickname(runtime, '   ')
  const longResult = await saveNickname(runtime, 'abcdefghijklmnop')

  assert.equal(emptyResult.reason, 'validation')
  assert.equal(longResult.reason, 'validation')
  assert.equal(runtime.calls.updateNickname, 0)
  assert.equal(runtime.savedSession, null)
}

async function testInvalidCode({ consumeDeviceCode, createInitialMainControllerState }) {
  const runtime = createRuntime(createInitialMainControllerState, {
    consumeResult: {
      ok: false,
      error: {
        kind: 'not_found',
        message: '사용할 수 없는 코드예요.',
        retryable: true,
      },
    },
  })

  const result = await consumeDeviceCode(runtime, ' wrong-0000 ')

  assert.equal(result.reason, 'not_found')
  assert.equal(runtime.state.settingsState, 'invalid')
  assert.equal(runtime.state.settingsValues.deviceCodeInput, 'WRONG-0000')
}

async function testExpiredCode({ consumeDeviceCode, createInitialMainControllerState }) {
  const runtime = createRuntime(createInitialMainControllerState, {
    consumeResult: {
      ok: false,
      error: {
        kind: 'expired',
        message: '만료된 코드예요. 새 코드를 발급해주세요.',
        retryable: true,
      },
    },
  })

  const result = await consumeDeviceCode(runtime, 'expired-0000')

  assert.equal(result.reason, 'expired')
  assert.equal(runtime.state.settingsState, 'expired')
  assert.equal(runtime.savedSession, null)
}

async function testRemoteErrorNoFallback({ consumeDeviceCode, createInitialMainControllerState }) {
  const runtime = createRuntime(createInitialMainControllerState, {
    dataMode: 'remote',
    consumeResult: {
      ok: false,
      error: {
        kind: 'server_unavailable',
        message: '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.',
        retryable: true,
      },
    },
  })

  const result = await consumeDeviceCode(runtime, 'TIGER-3392')

  assert.equal(result.reason, 'server_unavailable')
  assert.equal(runtime.state.settingsState, 'serverError')
  assert.equal(runtime.savedSession, null)
  assert.equal(runtime.calls.consumeDeviceCode, 1)
}

async function testBootReadsAssets({ bootMainController, createInitialMainControllerState }) {
  const runtime = createRuntime(createInitialMainControllerState, {
    assetResult: {
      ok: true,
      value: {
        mainState: 'avatarReady',
        avatar: {
          state: 'ready',
          title: '장착한 아바타',
          description: '내 창고에서 바꿀 수 있어요.',
          statusText: '사용 가능',
        },
        assetSummary: {
          total: 3,
          ready: 2,
          working: 1,
          failed: 0,
        },
      },
    },
  })

  const result = await bootMainController(runtime)

  assert.equal(result.reason, 'loaded')
  assert.equal(runtime.calls.loadMainSnapshot, 1)
  assert.equal(runtime.state.mainState, 'avatarReady')
  assert.equal(runtime.state.assetSummary.total, 3)
}

function createRuntime(createInitialMainControllerState, options = {}) {
  const session = options.session ?? {
    id: 'mock-user-relay',
    nickname: '릴레이러',
    token: 'mock-token-relay',
  }
  const settings = options.settings ?? {
    bgmVolume: 70,
    sfxVolume: 82,
    muted: false,
    nickname: '릴레이러',
    issuedCode: undefined,
    deviceCodeInput: '',
  }
  const runtime = {
    dataMode: options.dataMode ?? 'mock',
    state: {
      ...createInitialMainControllerState(settings),
      session,
      nickname: session?.nickname ?? settings.nickname,
    },
    routeChanges: [],
    savedSettings: [],
    savedSession: null,
    clearedSession: false,
    calls: {
      loadMainSnapshot: 0,
      updateNickname: 0,
      issueDeviceCode: 0,
      consumeDeviceCode: 0,
    },
    sessionStoragePort: {
      loadSession() {
        return session
      },
      saveSession(nextSession) {
        runtime.savedSession = nextSession
      },
      clearSession() {
        runtime.clearedSession = true
      },
    },
    settingsStoragePort: {
      loadSettings() {
        return settings
      },
      saveSettings(nextSettings) {
        runtime.savedSettings.push(nextSettings)
      },
    },
    sessionPort: {
      async updateNickname(currentSession, nickname) {
        runtime.calls.updateNickname += 1
        return (
          options.updateNicknameResult ?? {
            ok: true,
            value: { ...currentSession, nickname },
          }
        )
      },
    },
    assetPort: {
      async loadMainSnapshot() {
        runtime.calls.loadMainSnapshot += 1
        return (
          options.assetResult ?? {
            ok: true,
            value: {
              mainState: 'systemAvatar',
              avatar: {
                state: 'system',
                title: '기본 아바타 · 졸라맨',
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
        )
      },
    },
    deviceLinkPort: {
      async issueDeviceCode() {
        runtime.calls.issueDeviceCode += 1
        return (
          options.issueResult ?? {
            ok: true,
            value: {
              code: 'TIGER-3392',
              expiresAtMs: Date.now() + 300000,
            },
          }
        )
      },
      async consumeDeviceCode() {
        runtime.calls.consumeDeviceCode += 1
        return (
          options.consumeResult ?? {
            ok: true,
            value: {
              id: 'mock-user-device',
              nickname: '기기러',
              token: 'mock-token-device',
            },
          }
        )
      },
    },
    routePort: {
      navigateLogin() {
        runtime.routeChanges.push(['login'])
      },
      navigateLobby() {
        runtime.routeChanges.push(['lobby'])
      },
      navigateAssetStudio() {
        runtime.routeChanges.push(['asset-studio'])
      },
      navigateWarehouse(tab) {
        runtime.routeChanges.push(['warehouse', tab])
      },
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
