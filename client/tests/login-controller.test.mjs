import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')
const coreSource = read('client/src/pages/login/loginControllerCore.ts')
const hookSource = read('client/src/pages/login/useLoginController.ts')
const controllerSource = read('client/src/pages/login/LoginController.tsx')
const modeConfigSource = read('client/src/infrastructure/config/modeConfig.ts')
const mockPortSource = read('client/src/infrastructure/session/mockSessionPort.ts')
const remotePortSource = read('client/src/infrastructure/session/remoteSessionPort.ts')
const storagePortSource = read('client/src/infrastructure/session/browserSessionStoragePort.ts')
const routerSource = read('client/src/app/navigation/prototypeRouter.ts')
const appSource = read('client/src/app/AppV2.tsx')
const screenSource = read('client/src/pages/login/LoginScreen.tsx')

const core = await importTypeScriptModule(coreSource)

await testMockSuccess(core)
await testRemoteSuccess(core)
await testRemoteFailure(core)
await testInvalidToken(core)
await testDuplicateSubmit(core)

assert.match(coreSource, /export interface SessionPort/)
assert.match(coreSource, /export interface StoragePort/)
assert.match(coreSource, /normalizeNickname/)
assert.match(coreSource, /validateNickname/)
assert.match(coreSource, /bootLoginSession/)
assert.match(coreSource, /submitLoginNickname/)
assert.match(hookSource, /bootLoginSession/)
assert.match(hookSource, /submitLoginNickname/)
assert.match(controllerSource, /resolveV2ModeConfig/)
assert.match(controllerSource, /createMockSessionPort/)
assert.match(controllerSource, /createRemoteSessionPort/)
assert.match(controllerSource, /createBrowserSessionStoragePort/)
assert.match(controllerSource, /setPrototypeRoute\('main'\)/)
assert.match(controllerSource, /data-v2-data-mode=\{resolvedDependencies\.dataMode\}/)

assert.match(modeConfigSource, /VITE_DATA_MODE/)
assert.match(modeConfigSource, /allowMockApiFallback: false/)
assert.match(modeConfigSource, /allowLocalRealtimeFallback: false/)
assert.match(modeConfigSource, /parseDataMode/)
assert.match(mockPortSource, /createDeterministicMockSession/)
assert.match(remotePortSource, /\/api\/session/)
assert.match(remotePortSource, /\/api\/session\/validate/)
assert.match(remotePortSource, /server_unavailable/)
assert.match(remotePortSource, /malformed_response/)
assert.doesNotMatch(remotePortSource, /createMockSessionPort|mock fallback/i)
assert.match(storagePortSource, /relay\.session/)

assert.match(routerSource, /kind: 'main'/)
assert.match(routerSource, /screenId: 'S2_MAIN'/)
assert.match(appSource, /case 'login':/)
assert.match(appSource, /<LoginController \/>/)
assert.match(appSource, /case 'main':/)

assert.doesNotMatch(screenSource, /SessionPort|StoragePort|resolveV2(?:DataMode|ModeConfig)|localStorage|createMockSessionPort|createRemoteSessionPort/)

console.log('login controller contract self-test passed')

async function testMockSuccess({ submitLoginNickname }) {
  const runtime = createRuntime({
    dataMode: 'mock',
    createResult: {
      ok: true,
      value: { id: 'mock-user-relay', nickname: '릴레이러', token: 'mock-token-relay' },
    },
  })

  const result = await submitLoginNickname(runtime, '  릴레이러  ')

  assert.equal(result.reason, 'success')
  assert.equal(result.destination, 'main')
  assert.equal(runtime.calls.createSession, 1)
  assert.equal(runtime.savedSession.nickname, '릴레이러')
  assert.equal(runtime.routeChangedToMain, true)
}

async function testRemoteSuccess({ submitLoginNickname }) {
  const runtime = createRuntime({
    dataMode: 'remote',
    createResult: {
      ok: true,
      value: { id: 'remote-user-1', nickname: '원격러', token: 'remote-token-1' },
    },
  })

  const result = await submitLoginNickname(runtime, '원격러')

  assert.equal(result.reason, 'success')
  assert.equal(runtime.calls.createSession, 1)
  assert.equal(runtime.savedSession.token, 'remote-token-1')
  assert.equal(runtime.routeChangedToMain, true)
}

async function testRemoteFailure({ submitLoginNickname }) {
  const runtime = createRuntime({
    dataMode: 'remote',
    createResult: {
      ok: false,
      error: {
        kind: 'server_unavailable',
        message: '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.',
        retryable: true,
      },
    },
  })

  const result = await submitLoginNickname(runtime, '원격러')

  assert.equal(result.reason, 'error')
  assert.equal(runtime.viewState, 'serverError')
  assert.equal(runtime.savedSession, null)
  assert.equal(runtime.routeChangedToMain, false)
}

async function testInvalidToken({ bootLoginSession }) {
  const runtime = createRuntime({
    dataMode: 'remote',
    storedSession: { id: 'stale-user', nickname: '만료', token: 'bad-token' },
    validateResult: {
      ok: true,
      value: null,
    },
  })

  const result = await bootLoginSession(runtime)

  assert.equal(result.reason, 'invalid_session')
  assert.equal(runtime.clearedSession, true)
  assert.equal(runtime.viewState, 'default')
  assert.equal(runtime.routeChangedToMain, false)
}

async function testDuplicateSubmit({ submitLoginNickname }) {
  const runtime = createRuntime({
    dataMode: 'remote',
    currentState: 'submitting',
    createResult: {
      ok: true,
      value: { id: 'remote-user-2', nickname: '중복', token: 'remote-token-2' },
    },
  })

  const result = await submitLoginNickname(runtime, '중복')

  assert.equal(result.reason, 'duplicate')
  assert.equal(runtime.calls.createSession, 0)
  assert.equal(runtime.routeChangedToMain, false)
}

function createRuntime({
  dataMode,
  storedSession = null,
  createResult,
  validateResult = { ok: true, value: storedSession },
  currentState = 'default',
}) {
  const runtime = {
    dataMode,
    viewState: currentState,
    savedSession: null,
    clearedSession: false,
    routeChangedToMain: false,
    calls: {
      createSession: 0,
      validateSession: 0,
    },
    sessionPort: {
      async createSession() {
        runtime.calls.createSession += 1
        return createResult
      },
      async validateSession() {
        runtime.calls.validateSession += 1
        return validateResult
      },
    },
    storagePort: {
      loadSession() {
        return storedSession
      },
      saveSession(session) {
        runtime.savedSession = session
      },
      clearSession() {
        runtime.clearedSession = true
      },
    },
    routePort: {
      navigateMain() {
        runtime.routeChangedToMain = true
      },
    },
    getCurrentState() {
      return runtime.viewState
    },
    setViewState(nextState) {
      runtime.viewState = nextState
    },
    setNickname(nextNickname) {
      runtime.nickname = nextNickname
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
