import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dirname, '..', '..')

const coreSource = read('client/src/pages/asset-studio/assetStudioControllerCore.ts')
const hookSource = read('client/src/pages/asset-studio/useAssetStudioController.ts')
const controllerSource = read('client/src/pages/asset-studio/AssetStudioController.tsx')
const screenSource = read('client/src/pages/asset-studio/AssetStudioScreen.tsx')
const attributeFormSource = read('client/src/pages/asset-studio/AttributeForm.tsx')
const screenCss = read('client/src/pages/asset-studio/AssetStudioScreen.module.css')
const fixturesSource = read('client/src/fixtures/asset-studio/assetStudioFixtures.ts')
const mockPortSource = read('client/src/infrastructure/asset-studio/mockAssetStudioAssetPort.ts')
const remotePortSource = read('client/src/infrastructure/asset-studio/remoteAssetStudioAssetPort.ts')
const layoutStorageSource = read('client/src/infrastructure/asset-studio/browserAssetStudioLayoutStorage.ts')
const drawingPortSource = read('client/src/infrastructure/asset-studio/assetStudioDrawingPort.ts')
const studioComponentsSource = read('client/src/design-system/studio/StudioComponents.tsx')
const appSource = read('client/src/app/AppV2.tsx')
const gallerySource = read('client/src/dev/state-gallery/StateGallery.tsx')
const galleryFixturesSource = read('client/src/dev/state-gallery/fixtures.ts')
const studioShellCss = read('client/src/design-system/shells/StudioShell/StudioShell.module.css')

const core = await importTypeScriptModule(coreSource)

await testMissingNameBlocksSubmit(core)
await testLoadedUnchangedBlocksSubmit(core)
await testResizeResamples(core)
await testSubmitSuccessStaysInStudio(core)
await testLayoutPersistence(core)
await testWarehouseCta(core)

assert.equal(statSync(join(repoRoot, 'client/src/pages/asset-studio/AssetStudioScreen.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/pages/asset-studio/AssetStudioController.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/pages/asset-studio/AttributeForm.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/asset-studio/mockAssetStudioAssetPort.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/infrastructure/asset-studio/remoteAssetStudioAssetPort.ts')).isFile(), true)

for (const state of [
  'default',
  'leftCollapsed',
  'rightCollapsed',
  'resizing',
  'sizeChanged',
  'loadMine',
  'loadOthers',
  'loadedUnchanged',
  'loadedChanged',
  'invalidMissingName',
  'submitting',
  'submitSuccess',
  'submitFailed',
]) {
  assert.match(screenSource, new RegExp(`['"]${state}['"]`), `screen missing state ${state}`)
  assert.match(fixturesSource, new RegExp(`state,|['"]${state}['"]`), `fixture state scan failed for ${state}`)
}

for (const copy of [
  '에셋 스튜디오',
  '에셋 불러오기',
  '내가 만든',
  '남이 만든',
  '새 에셋 만들기',
  '창고에서 진행 상황 보기',
  '에셋 생성을 요청했어요.',
  '이름을 입력해 주세요.',
  '불러온 에셋을 수정한 뒤 만들 수 있어요.',
  '플랫폼',
  '장애물',
  '몬스터',
  '배경',
]) {
  assert.match(
    screenSource + attributeFormSource + fixturesSource + coreSource + studioComponentsSource,
    new RegExp(escapeRegExp(copy)),
    `missing Korean copy: ${copy}`,
  )
}

assert.match(coreSource, /export interface AssetStudioAssetPort/)
assert.match(coreSource, /export interface AssetStudioDrawingPort/)
assert.match(coreSource, /export interface AssetStudioLayoutStorage/)
assert.match(coreSource, /loadedSource/)
assert.match(coreSource, /lastSubmittedHash/)
assert.match(coreSource, /resizeAndResample\(normalizedSize, 'nearest'\)/)
assert.match(coreSource, /createComponentAsset/)
assert.match(coreSource, /navigateWarehouseComponent/)
assert.match(hookSource, /bootAssetStudioController/)
assert.match(controllerSource, /createMockAssetStudioAssetPort/)
assert.match(controllerSource, /createRemoteAssetStudioAssetPort/)
assert.match(controllerSource, /createAssetStudioDrawingPort/)
assert.match(controllerSource, /createBrowserAssetStudioLayoutStorage/)
assert.match(controllerSource, /setPrototypeRoute\('warehouse', \{ tab: 'component', filter: 'all' \}\)/)
assert.match(appSource, /case 'assetStudio':/)
assert.match(appSource, /<AssetStudioController routeState=\{route\.contractRoute\} \/>/)
assert.match(galleryFixturesSource, /assetStudioScreenFixtures/)
assert.match(gallerySource, /<AssetStudioScreen/)
assert.match(layoutStorageSource, /relay\.studioLayout/)
assert.match(mockPortSource, /relay\.mock\.assets/)
assert.match(mockPortSource, /schemaVersion: 'mock-asset-studio-assets-v1'/)
assert.match(remotePortSource, /\/api\/assets\/generate/)
assert.doesNotMatch(remotePortSource, /createMock|Mock fallback|relay\.mock/i)
assert.match(drawingPortSource, /createDrawingEngineCore/)
assert.match(drawingPortSource, /encodePngDataUrl/)
assert.match(drawingPortSource, /resizeAndResample/)
assert.match(studioShellCss, /--studio-left-panel-width/)
assert.match(studioShellCss, /--studio-right-panel-width/)
assert.match(screenSource, /surface="paper"/)
assert.match(screenSource, /showVisibleFrame=\{false\}/)
assert.match(screenSource, /showStatus=\{false\}/)
assert.match(screenSource, /gridVisible=\{false\}/)
assert.match(screenSource, /outsideDim=\{false\}/)
assert.match(screenSource, /assetCanvasSurface/)
assert.doesNotMatch(screenSource, /workspaceMeta/)
assert.doesNotMatch(screenSource, /getStateLabel/)
assert.doesNotMatch(screenSource, /격자 켜기|격자 끄기|어두운 체커|밝은 체커/)

assert.doesNotMatch(attributeFormSource, /item|avatar/)
assert.doesNotMatch(
  screenSource + attributeFormSource,
  /SessionPort|StoragePort|AssetStudioAssetPort|localStorage|\/api\/|createMock|createRemote/i,
)
assert.doesNotMatch(screenCss, /#[0-9a-fA-F]{3,8}/)

console.log('asset studio controller contract self-test passed')

async function testMissingNameBlocksSubmit({ createInitialAssetStudioControllerState, submitAssetStudio }) {
  const runtime = createRuntime(createInitialAssetStudioControllerState)
  runtime.state.form.name = ''

  const result = await submitAssetStudio(runtime)

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'validation')
  assert.equal(runtime.calls.createComponentAsset, 0)
  assert.equal(runtime.state.viewState, 'invalidMissingName')
}

async function testLoadedUnchangedBlocksSubmit({
  createInitialAssetStudioControllerState,
  loadAssetStudioSource,
  submitAssetStudio,
}) {
  const runtime = createRuntime(createInitialAssetStudioControllerState, {
    assets: [createAsset()],
  })
  const loadResult = loadAssetStudioSource(runtime, 'asset-ready')
  const submitResult = await submitAssetStudio(runtime)

  assert.equal(loadResult.ok, true)
  assert.equal(submitResult.ok, false)
  assert.equal(submitResult.reason, 'validation')
  assert.equal(runtime.calls.createComponentAsset, 0)
  assert.match(runtime.state.submitError, /수정/)
}

async function testResizeResamples({ createInitialAssetStudioControllerState, resizeAssetStudioCanvas }) {
  const runtime = createRuntime(createInitialAssetStudioControllerState)
  const result = resizeAssetStudioCanvas(runtime, { widthCells: 4, heightCells: 2 })

  assert.equal(result.ok, true)
  assert.equal(runtime.calls.resizeAndResample, 1)
  assert.deepEqual(runtime.resizedTo, { widthCells: 4, heightCells: 2, mode: 'nearest' })
  assert.equal(runtime.state.viewState, 'sizeChanged')
}

async function testSubmitSuccessStaysInStudio({
  createInitialAssetStudioControllerState,
  submitAssetStudio,
}) {
  const runtime = createRuntime(createInitialAssetStudioControllerState)
  runtime.state.form.name = '구름 발판'

  const firstResult = await submitAssetStudio(runtime)
  const secondResult = await submitAssetStudio(runtime)

  assert.equal(firstResult.ok, true)
  assert.equal(secondResult.ok, false)
  assert.equal(secondResult.reason, 'validation')
  assert.equal(runtime.calls.createComponentAsset, 1)
  assert.equal(runtime.state.viewState, 'submitSuccess')
  assert.equal(runtime.state.toastVisible, true)
  assert.deepEqual(runtime.routeChanges, [])
  assert.equal(runtime.createdPayload.category, 'platform')
  assert.equal(runtime.createdPayload.name, '구름 발판')
  assert.equal(runtime.createdPayload.widthCells, 2)
  assert.equal(runtime.createdPayload.heightCells, 1)
}

async function testLayoutPersistence({
  createInitialAssetStudioControllerState,
  createAssetStudioCallbacks,
}) {
  const runtime = createRuntime(createInitialAssetStudioControllerState)
  const callbacks = createAssetStudioCallbacks(runtime)

  callbacks.onToggleLeftPanel()
  callbacks.onResizePanel('right', 24)
  callbacks.onResizeToolBlock(0.05)

  assert.equal(runtime.savedLayouts.length, 3)
  assert.equal(runtime.state.layout.leftCollapsed, true)
  assert.equal(runtime.state.layout.rightPanelWidth, 364)
  assert.equal(runtime.state.layout.resizing, 'tools')
}

async function testWarehouseCta({
  createInitialAssetStudioControllerState,
  createAssetStudioCallbacks,
}) {
  const runtime = createRuntime(createInitialAssetStudioControllerState)
  const callbacks = createAssetStudioCallbacks(runtime)

  callbacks.onOpenWarehouse()

  assert.deepEqual(runtime.routeChanges, [['warehouse', 'component']])
}

function createRuntime(createInitialAssetStudioControllerState, options = {}) {
  const session = options.session ?? {
    id: 'mock-user',
    nickname: '릴레이러',
    token: 'mock-token',
  }
  const runtime = {
    dataMode: options.dataMode ?? 'mock',
    state: {
      ...createInitialAssetStudioControllerState(),
      session,
      loadableAssets: options.assets ?? [],
    },
    calls: {
      createComponentAsset: 0,
      resizeAndResample: 0,
    },
    routeChanges: [],
    savedLayouts: [],
    createdPayload: null,
    resizedTo: null,
    drawingHash: 'drawing-hash-default',
    sessionStoragePort: {
      loadSession() {
        return session
      },
      saveSession() {
        return undefined
      },
      clearSession() {
        return undefined
      },
    },
    layoutStorage: {
      loadLayout() {
        return runtime.state.layout
      },
      saveLayout(layout) {
        runtime.savedLayouts.push(layout)
      },
    },
    assetPort: {
      async listLoadableAssets() {
        return {
          ok: true,
          value: runtime.state.loadableAssets,
        }
      },
      async createComponentAsset(payload) {
        runtime.calls.createComponentAsset += 1
        runtime.createdPayload = payload

        return {
          ok: true,
          value: {
            id: 'created-asset',
            creatorId: payload.userId,
            category: payload.category,
            name: payload.name,
            description: payload.description,
            attrs: payload.attrs,
            widthCells: payload.widthCells,
            heightCells: payload.heightCells,
            status: 'generating',
            sourceImageUrl: payload.image,
            isMine: true,
          },
        }
      },
    },
    drawingPort: {
      getHash() {
        return runtime.drawingHash
      },
      reset(size) {
        runtime.drawingHash = `reset-${size.widthCells}x${size.heightCells}`
        return {
          ok: true,
          value: {
            hash: runtime.drawingHash,
          },
        }
      },
      resizeAndResample(size, mode) {
        runtime.calls.resizeAndResample += 1
        runtime.resizedTo = { ...size, mode }
        runtime.drawingHash = `resized-${size.widthCells}x${size.heightCells}`
        return {
          ok: true,
          value: {
            hash: runtime.drawingHash,
          },
        }
      },
      loadAssetSource(asset) {
        runtime.drawingHash = `loaded-${asset.id}`
        return {
          ok: true,
          value: {
            hash: runtime.drawingHash,
          },
        }
      },
      exportPng() {
        return {
          ok: true,
          value: {
            image: 'data:image/png;base64,asset',
            hash: runtime.drawingHash,
          },
        }
      },
      undo() {
        return true
      },
      redo() {
        return true
      },
      clear() {
        runtime.drawingHash = 'cleared'
        return {
          ok: true,
          value: {
            hash: runtime.drawingHash,
          },
        }
      },
    },
    routePort: {
      navigateLogin() {
        runtime.routeChanges.push(['login'])
      },
      navigateMain() {
        runtime.routeChanges.push(['main'])
      },
      navigateWarehouseComponent() {
        runtime.routeChanges.push(['warehouse', 'component'])
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

function createAsset() {
  return {
    id: 'asset-ready',
    creatorId: 'mock-user',
    category: 'platform',
    name: '튼튼한 발판 원본',
    description: '원본 설명',
    attrs: {
      behaviors: 'solid',
      collider: 'solid',
      motion: 'static',
    },
    widthCells: 2,
    heightCells: 1,
    status: 'ready',
    sourceImageUrl: '',
    isMine: true,
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
