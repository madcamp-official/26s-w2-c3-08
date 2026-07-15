import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')
const shellRoot = join(repoRoot, 'client', 'src', 'design-system', 'shells')
const uiLabSource = read('client/src/dev/ui-lab/UiLab.tsx')
const appV2Source = read('client/src/app/AppV2.tsx')

const shellNames = ['LauncherShell', 'StudioShell', 'GameShell']

for (const shellName of shellNames) {
  assert.equal(statSync(join(shellRoot, shellName, `${shellName}.tsx`)).isFile(), true, `${shellName} source is missing`)
  assert.equal(
    statSync(join(shellRoot, shellName, `${shellName}.module.css`)).isFile(),
    true,
    `${shellName} styles are missing`,
  )
  assert.match(read(`client/src/design-system/shells/${shellName}/${shellName}.tsx`), new RegExp(`data-v2-component="${toKebab(shellName)}"`))
}

const launcherSource = read('client/src/design-system/shells/LauncherShell/LauncherShell.tsx')
const launcherCss = read('client/src/design-system/shells/LauncherShell/LauncherShell.module.css')
const studioSource = read('client/src/design-system/shells/StudioShell/StudioShell.tsx')
const studioCss = read('client/src/design-system/shells/StudioShell/StudioShell.module.css')
const gameSource = read('client/src/design-system/shells/GameShell/GameShell.tsx')
const gameCss = read('client/src/design-system/shells/GameShell/GameShell.module.css')

assert.match(launcherSource, /data-v2-shell="launcher"/)
assert.match(launcherSource, /modalLayer/)
assert.match(launcherSource, /toastLayer/)
assert.match(launcherSource, /primaryNav/)
assert.match(launcherSource, /leadingNav/)
assert.match(launcherSource, /backgroundVideoSrc/)
assert.match(launcherSource, /className=\{styles\.backgroundVideo\}/)
assert.match(launcherSource, /titleTone = 'yellow'/)
assert.match(launcherSource, /layout = 'framed'/)
assert.match(launcherSource, /data-layout=\{layout\}/)
assert.match(launcherSource, /data-title-tone=\{titleTone\}/)
assert.match(launcherCss, /linear-gradient/)
assert.match(launcherCss, /background-size: var\(--spacing-8\) var\(--spacing-8\)/)
assert.match(launcherCss, /\[data-layout='centered'\]/)
assert.match(launcherCss, /\[data-layout='open'\]/)
assert.match(launcherCss, /\.backgroundVideoLayer/)
assert.match(launcherCss, /object-fit: cover/)
assert.match(launcherCss, /opacity: var\(--opacity-overlay-medium\)/)
assert.match(launcherCss, /var\(--semantic-color-launcher-title-surface\)/)
assert.match(launcherCss, /var\(--semantic-color-launcher-panel\)/)

assert.match(studioSource, /data-v2-shell="studio"/)
assert.match(studioSource, /leftPanelState/)
assert.match(studioSource, /rightPanelState/)
assert.match(studioSource, /data-left-panel-state=\{leftPanelState\}/)
assert.match(studioSource, /data-right-panel-state=\{rightPanelState\}/)
assert.match(studioCss, /--studio-left-column-width: minmax\(var\(--spacing-16\), var\(--studio-left-panel-width\)\)/)
assert.match(studioCss, /--studio-right-column-width: minmax\(var\(--spacing-16\), var\(--studio-right-panel-width\)\)/)
assert.match(studioCss, /grid-template-columns: var\(--studio-left-column-width\) minmax\(520px, 1fr\) var\(--studio-right-column-width\)/)
assert.match(studioCss, /\.shell\[data-left-panel-state='collapsed'\]/)
assert.match(studioCss, /\.shell\[data-right-panel-state='collapsed'\]/)
assert.match(studioCss, /\.panel\[data-state='collapsed'\]/)
assert.match(studioCss, /\.panel\[data-state='resizing'\]/)
assert.match(studioCss, /min-width: 520px/)

assert.match(gameSource, /data-v2-shell="game"/)
assert.match(gameSource, /canvas/)
assert.match(gameSource, /topHud/)
assert.match(gameSource, /leftShelf/)
assert.match(gameSource, /rightToolDock/)
assert.match(gameSource, /bottomOverlay/)
assert.match(gameSource, /data-has-left-shelf=\{leftShelf \? 'true' : 'false'\}/)
assert.match(gameSource, /data-has-right-tool-dock=\{rightToolDock \? 'true' : 'false'\}/)
assert.match(gameCss, /grid-template-areas:/)
assert.match(gameCss, /"left canvas right"/)
assert.match(gameCss, /\.shell\[data-has-left-shelf='false'\]\[data-has-right-tool-dock='false'\]/)
assert.match(gameCss, /grid-template-columns: minmax\(0, 1fr\)/)
assert.match(gameCss, /min-width: 0/)
assert.match(gameCss, /min-height: 420px/)
assert.match(gameCss, /z-index: var\(--z-index-base\)/)

for (const viewport of ['1280x720', '1440x900', '1920x1080']) {
  assert.match(uiLabSource, new RegExp(`['"]${viewport}['"]`), `UI Lab missing ${viewport}`)
}
for (const shellName of shellNames) {
  assert.match(uiLabSource, new RegExp(shellName), `UI Lab missing ${shellName}`)
  assert.match(appV2Source, new RegExp(shellName), `Shell preview route missing ${shellName}`)
}
assert.match(uiLabSource, /'collapsed'/)
assert.match(uiLabSource, /modalLayerVisible/)
assert.match(uiLabSource, /previewState === 'offline'/)
assert.match(uiLabSource, /data-viewport=\{viewport\}/)
assert.match(read('client/src/app/AppV2.css'), /data-viewport='1280x720'/)
assert.match(read('client/src/app/AppV2.css'), /data-viewport='1440x900'/)
assert.match(read('client/src/app/AppV2.css'), /data-viewport='1920x1080'/)

const forbiddenImportPattern = /(zustand|appStore|localStorage|realtime|socket|api\/|net\/|phaser)/i
const rawHexPattern = /(^|[^A-Za-z0-9])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![A-Za-z0-9])/g
const rawColorFunctionPattern = /\brgba?\(/
const violations = []

for (const filePath of walkFiles(shellRoot)) {
  const source = readFileSync(filePath, 'utf8')
  const relativePath = relative(repoRoot, filePath)

  if (forbiddenImportPattern.test(source)) {
    violations.push(`${relativePath}: forbidden runtime import reference`)
  }

  if (rawColorFunctionPattern.test(source)) {
    violations.push(`${relativePath}: raw rgb/rgba usage`)
  }

  source.split('\n').forEach((line, index) => {
    if (rawHexPattern.test(line)) {
      violations.push(`${relativePath}:${index + 1}: raw hex usage`)
    }

    rawHexPattern.lastIndex = 0
  })
}

assert.deepEqual(violations, [], `shell component contract violations:\n${violations.join('\n')}`)

console.log('shell component contract self-test passed')

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

function walkFiles(root) {
  const files = []

  for (const entry of readdirSync(root)) {
    const entryPath = join(root, entry)
    const stat = statSync(entryPath)

    if (stat.isDirectory()) {
      files.push(...walkFiles(entryPath))
    } else if (stat.isFile()) {
      files.push(entryPath)
    }
  }

  return files
}

function toKebab(value) {
  return value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}
