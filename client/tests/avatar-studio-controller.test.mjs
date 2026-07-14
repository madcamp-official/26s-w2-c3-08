import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')
const coreSource = read('client/src/pages/avatar-studio/avatarStudioControllerCore.ts')
const controllerSource = read('client/src/pages/avatar-studio/AvatarStudioController.tsx')
const hookSource = read('client/src/pages/avatar-studio/useAvatarStudioController.ts')
const screenSource = read('client/src/pages/avatar-studio/AvatarStudioScreen.tsx')
const screenCss = read('client/src/pages/avatar-studio/AvatarStudioScreen.module.css')
const drawingPortSource = read('client/src/infrastructure/avatar-studio/avatarStudioDrawingPort.ts')
const layoutStorageSource = read('client/src/infrastructure/avatar-studio/browserAvatarStudioLayoutStorage.ts')
const mockPortSource = read('client/src/infrastructure/avatar-studio/mockAvatarStudioAssetPort.ts')
const remotePortSource = read('client/src/infrastructure/avatar-studio/remoteAvatarStudioAssetPort.ts')
const appSource = read('client/src/app/AppV2.tsx')
const routerSource = read('client/src/app/navigation/prototypeRouter.ts')
const gallerySource = read('client/src/dev/state-gallery/StateGallery.tsx')
const galleryFixturesSource = read('client/src/dev/state-gallery/fixtures.ts')
const fixturesSource = read('client/src/fixtures/avatar-studio/avatarStudioFixtures.ts')
const packageSource = read('client/package.json')

const core = await importTypeScriptModule(coreSource)

await testNameValidation(core)
await testLoadedUnchangedBlocksSubmit(core)
await testSubmitSuccessNavigatesMain(core)
await testMissingSessionNavigatesLogin(core)

assert.match(coreSource, /export interface AvatarStudioAssetPort/)
assert.match(coreSource, /export interface AvatarStudioDrawingPort/)
assert.match(coreSource, /export interface AvatarStudioLayoutStorage/)
assert.match(coreSource, /listAvatarAssets/)
assert.match(coreSource, /createAvatar/)
assert.match(coreSource, /navigateWarehouseAvatar/)
assert.match(coreSource, /navigateMain\(\)/)
assert.match(hookSource, /bootAvatarStudioController/)
assert.match(hookSource, /createAvatarStudioScreenProps/)
assert.match(controllerSource, /createMockAvatarStudioAssetPort/)
assert.match(controllerSource, /createRemoteAvatarStudioAssetPort/)
assert.match(controllerSource, /createAvatarStudioDrawingPort/)
assert.match(controllerSource, /createBrowserAvatarStudioLayoutStorage/)
assert.match(controllerSource, /setPrototypeRoute\('warehouse', \{ tab: 'avatar' \}\)/)
assert.match(appSource, /case 'avatarStudio':/)
assert.match(appSource, /<AvatarStudioController routeState=\{route\.contractRoute\} \/>/)
assert.doesNotMatch(appSource, /A Avatar Studio placeholder/)
assert.match(routerSource, /label: 'Avatar Studio'/)
assert.match(galleryFixturesSource, /avatarStudioScreenFixtures/)
assert.match(gallerySource, /<AvatarStudioScreen/)
assert.match(fixturesSource, /A_AVATAR_STUDIO/)
assert.match(layoutStorageSource, /relay\.avatarStudioLayout/)
assert.match(mockPortSource, /relay\.mock\.assets/)
assert.match(mockPortSource, /schemaVersion: 'mock-avatar-studio-assets-v1'/)
assert.match(remotePortSource, /\/api\/assets\/generate/)
assert.doesNotMatch(remotePortSource, /createMock|Mock fallback|relay\.mock/i)
assert.match(drawingPortSource, /AVATAR_DRAWING_DIMENSIONS/)
assert.match(drawingPortSource, /encodePngDataUrl/)
assert.match(drawingPortSource, /width: imageData\.width/)
assert.match(drawingPortSource, /height: imageData\.height/)
assert.match(screenSource, /AVATAR_VISIBLE_WIDTH/)
assert.match(screenSource, /AVATAR_WORKSPACE_WIDTH/)
assert.match(screenSource, /onPaste=\{\(event\) => event\.preventDefault\(\)\}/)
assert.match(packageSource, /avatar-studio:check/)

assert.doesNotMatch(
  screenSource,
  /SessionPort|StoragePort|AvatarStudioAssetPort|localStorage|\/api\/|createMock|createRemote|resolveV2/i,
)
assert.doesNotMatch(screenCss, /#[0-9a-fA-F]{3,8}/)

console.log('avatar studio controller contract self-test passed')

async function testNameValidation({ createInitialAvatarStudioControllerState, submitAvatarStudio }) {
  const runtime = createRuntime(createInitialAvatarStudioControllerState)
  runtime.state.form.name = ''

  const result = await submitAvatarStudio(runtime)

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'validation')
  assert.equal(runtime.state.viewState, 'invalidName')
  assert.equal(runtime.assetPort.createCalls.length, 0)
}

async function testLoadedUnchangedBlocksSubmit({
  createInitialAvatarStudioControllerState,
  loadAvatarStudioSource,
  submitAvatarStudio,
}) {
  const runtime = createRuntime(createInitialAvatarStudioControllerState)
  runtime.state.loadableAvatars = [
    {
      id: 'avatar-1',
      creatorId: 'user-1',
      name: '기존아바타',
      description: '원본',
      status: 'ready',
      sourceImageUrl: '',
      isMine: true,
    },
  ]

  const loadResult = loadAvatarStudioSource(runtime, 'avatar-1')
  assert.equal(loadResult.ok, true)

  const result = await submitAvatarStudio(runtime)

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'validation')
  assert.equal(runtime.assetPort.createCalls.length, 0)
}

async function testSubmitSuccessNavigatesMain({ createInitialAvatarStudioControllerState, submitAvatarStudio }) {
  const runtime = createRuntime(createInitialAvatarStudioControllerState)
  runtime.state.form.name = '새아바타'
  runtime.drawingPort.hash = 'changed-hash'

  const result = await submitAvatarStudio(runtime)

  assert.equal(result.ok, true)
  assert.equal(runtime.assetPort.createCalls.length, 1)
  assert.equal(runtime.assetPort.createCalls[0].category, undefined)
  assert.equal(runtime.assetPort.createCalls[0].name, '새아바타')
  assert.deepEqual(runtime.routeChanges, ['main'])
}

async function testMissingSessionNavigatesLogin({ createInitialAvatarStudioControllerState, bootAvatarStudioController }) {
  const runtime = createRuntime(createInitialAvatarStudioControllerState, { session: null })

  const result = await bootAvatarStudioController(runtime)

  assert.equal(result.destination, 'login')
  assert.deepEqual(runtime.routeChanges, ['login'])
}

function createRuntime(createInitialAvatarStudioControllerState, options = {}) {
  const session = options.session === undefined
    ? { id: 'user-1', nickname: '릴레이러', token: 'token', avatarAssetId: null }
    : options.session
  const runtime = {
    dataMode: 'mock',
    state: createInitialAvatarStudioControllerState(),
    routeChanges: [],
    sessionStoragePort: {
      loadSession: () => session,
      saveSession: () => undefined,
      clearSession: () => undefined,
    },
    layoutStorage: {
      loadLayout: () => runtime.state.layout,
      saveLayout: (layout) => {
        runtime.savedLayout = layout
      },
    },
    assetPort: {
      createCalls: [],
      async listAvatarAssets() {
        return { ok: true, value: [] }
      },
      async createAvatar(payload) {
        this.createCalls.push(payload)
        return {
          ok: true,
          value: {
            id: 'created-avatar',
            creatorId: payload.userId,
            name: payload.name,
            description: payload.description,
            status: 'generating',
            sourceImageUrl: payload.image,
            isMine: true,
          },
        }
      },
    },
    drawingPort: {
      hash: 'initial-hash',
      getHash() {
        return this.hash
      },
      reset() {
        this.hash = 'reset-hash'
        return { ok: true, value: { hash: this.hash } }
      },
      loadAvatarSource() {
        this.hash = 'loaded-hash'
        return { ok: true, value: { hash: this.hash } }
      },
      exportPng() {
        return {
          ok: true,
          value: {
            image: 'data:image/png;base64,test',
            hash: this.hash,
            width: 256,
            height: 512,
          },
        }
      },
      undo: () => false,
      redo: () => false,
      clear() {
        this.hash = 'clear-hash'
        return { ok: true, value: { hash: this.hash } }
      },
    },
    routePort: {
      navigateLogin: () => runtime.routeChanges.push('login'),
      navigateMain: () => runtime.routeChanges.push('main'),
      navigateWarehouseAvatar: () => runtime.routeChanges.push('warehouse:avatar'),
    },
    getState: () => runtime.state,
    setState: (updater) => {
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
