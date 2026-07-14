import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')

const componentSource = read('client/src/design-system/studio/StudioComponents.tsx')
const componentCss = read('client/src/design-system/studio/StudioComponents.module.css')
const indexSource = read('client/src/design-system/studio/index.ts')
const fixtureSource = read('client/src/fixtures/studio/studioFixtures.ts')
const uiLabSource = read('client/src/dev/ui-lab/UiLab.tsx')
const appSource = read('client/src/app/AppV2.tsx')

assert.equal(statSync(join(repoRoot, 'client/src/design-system/studio/StudioComponents.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/design-system/studio/StudioComponents.module.css')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/fixtures/studio/studioFixtures.ts')).isFile(), true)

for (const component of [
  'StudioPanel',
  'PanelResizeHandle',
  'ToolButton',
  'DrawingToolbar',
  'BrushSizeControl',
  'PaletteGrid',
  'PaletteSwatch',
  'DrawingViewport',
  'AttributeField',
  'AssetLoadModal',
  'DirtyStateNotice',
]) {
  assert.match(componentSource, new RegExp(`export function ${component}`), `missing ${component}`)
  assert.match(indexSource, new RegExp(component), `index export missing ${component}`)
}

for (const state of [
  'expanded',
  'collapsed',
  'resizing',
  'activeTool',
  'disabledTool',
  'lightChecker',
  'darkChecker',
  'gridOff',
  'outsideDim',
  'unchanged',
  'changed',
]) {
  assert.match(uiLabSource, new RegExp(`['"]${state}['"]`), `UI Lab missing state ${state}`)
}

assert.match(componentSource, /role="separator"/)
assert.match(componentSource, /aria-orientation/)
assert.match(componentSource, /aria-pressed/)
assert.match(componentSource, /role="toolbar"/)
assert.match(componentSource, /role="status"/)
assert.match(componentSource, /aria-live="polite"/)
assert.match(componentSource, /data-v2-layer="checker"/)
assert.match(componentSource, /data-v2-layer="source-canvas"/)
assert.match(componentSource, /data-v2-layer="outside-dim"/)
assert.match(componentSource, /data-v2-layer="grid"/)
assert.match(componentSource, /data-v2-layer="visible-frame"/)
assert.match(componentSource, /checkerMode/)
assert.match(componentSource, /gridVisible/)
assert.match(componentSource, /outsideDim/)
assert.match(componentSource, /workspaceSize/)
assert.match(componentSource, /visibleFrame/)

assert.match(componentCss, /\.checkerLayer/)
assert.match(componentCss, /\.sourceLayer/)
assert.match(componentCss, /\.outsideDimLayer/)
assert.match(componentCss, /\.gridLayer/)
assert.match(componentCss, /\.visibleFrame/)
assert.match(componentCss, /background: var\(--swatch-color\)/)
assert.match(componentCss, /min-height: var\(--spacing-10\)/)
assert.match(componentCss, /:focus-visible/)

assert.match(fixtureSource, /studioToolFixtures/)
assert.match(fixtureSource, /paletteSwatches/)
assert.match(fixtureSource, /assetLoadFixtures/)
assert.match(fixtureSource, /var\(--semantic-color-action-primary-background\)/)

assert.match(uiLabSource, /StudioToolsShowcase/)
assert.match(uiLabSource, /category === 'Studio Tools'/)
assert.match(uiLabSource, /DrawingViewport/)
assert.match(uiLabSource, /AssetLoadModal/)
assert.match(uiLabSource, /Drawing Engine acceptance가 PASS하지 않았으므로/)
assert.doesNotMatch(appSource, /design-system\/studio|StudioToolsShowcase/)

const forbiddenRuntimePattern = /(zustand|appStore|localStorage|realtime|socket|api\/|net\/|phaser|experiments\/drawing-engine)/i
const rawHexPattern = /(^|[^A-Za-z0-9])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![A-Za-z0-9])/
const rawColorFunctionPattern = /\brgba?\(/

for (const [name, source] of [
  ['StudioComponents.tsx', componentSource],
  ['StudioComponents.module.css', componentCss],
  ['studioFixtures.ts', fixtureSource],
]) {
  assert.doesNotMatch(source, forbiddenRuntimePattern, `${name} has forbidden runtime import reference`)
  assert.doesNotMatch(source, rawHexPattern, `${name} has raw hex usage`)
  assert.doesNotMatch(source, rawColorFunctionPattern, `${name} has raw rgb/rgba usage`)
}

console.log('studio component contract self-test passed')

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
