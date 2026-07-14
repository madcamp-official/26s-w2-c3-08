import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')

const launcherShellSource = read('client/src/design-system/shells/LauncherShell/LauncherShell.tsx')
const launcherShellCss = read('client/src/design-system/shells/LauncherShell/LauncherShell.module.css')
const loginCss = read('client/src/pages/login/LoginScreen.module.css')
const mainCss = read('client/src/pages/main/MainScreen.module.css')
const warehouseCss = read('client/src/pages/warehouse/WarehouseScreen.module.css')
const badgeCss = read('client/src/design-system/components/Badge/Badge.module.css')
const modalCss = read('client/src/design-system/components/Modal/Modal.module.css')
const toastCss = read('client/src/design-system/components/Toast/Toast.module.css')
const stateGallerySource = read('client/src/dev/state-gallery/StateGallery.tsx')
const stateGalleryFixturesSource = read('client/src/dev/state-gallery/fixtures.ts')
const mainFixturesSource = read('client/src/fixtures/main/mainFixtures.ts')
const warehouseFixturesSource = read('client/src/fixtures/warehouse/warehouseFixtures.ts')
const screenshotSpec = read('client/tests/visual/launcher-screenshots.spec.ts')
const screenshotConfig = read('client/playwright.launcher.config.ts')
const lobbyRoomConfig = read('client/playwright.lobby-room.config.ts')
const viteConfig = read('client/vite.config.ts')
const packageJson = read('client/package.json')

assert.equal(statSync(join(repoRoot, 'client/playwright.launcher.config.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/playwright.lobby-room.config.ts')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/tests/visual/launcher-screenshots.spec.ts')).isFile(), true)

assert.match(launcherShellSource, /role="status"/)
assert.match(launcherShellSource, /aria-live="polite"/)
assert.match(launcherShellCss, /grid-template-rows: auto minmax\(0, 1fr\)/)
assert.match(launcherShellCss, /overflow: auto/)
assert.match(launcherShellCss, /scrollbar-gutter: stable/)

assert.match(loginCss, /align-self: center/)
assert.match(loginCss, /\.previewBlock::before/)
assert.match(mainCss, /\.avatarPreview::before/)
assert.match(mainCss, /\.volumeField input:focus-visible/)
assert.match(warehouseCss, /\.assetPreview::before/)
assert.match(warehouseCss, /min-height: min\(calc\(var\(--spacing-16\) \* 6\), 52svh\)/)

assert.match(badgeCss, /overflow-wrap: anywhere/)
assert.match(modalCss, /--modal-width: calc\(var\(--spacing-16\) \* 14 \+ var\(--spacing-6\)\)/)
assert.match(toastCss, /width: min\(calc\(var\(--spacing-16\) \* 8\), 100%\)/)

assert.match(stateGalleryFixturesSource, /stateGalleryViewports/)
assert.match(stateGalleryFixturesSource, /launcherStateGalleryUrls/)
assert.match(stateGalleryFixturesSource, /launcherScreenshotMatrix/)
assert.match(stateGallerySource, /launcherStateGalleryUrls/)
assert.match(stateGallerySource, /data-v2-component="launcher-state-url-list"/)
assert.match(stateGallerySource, /v2-launcher-url-list/)

assert.match(mainFixturesSource, /longFixtureNickname/)
assert.match(warehouseFixturesSource, /긴 이름/)
assert.match(warehouseFixturesSource, /줄바꿈되는지 확인/)

for (const viewport of ['1280x720', '1440x900', '1920x1080']) {
  assert.match(screenshotSpec, new RegExp(`['"]${viewport}['"]`), `screenshot spec missing ${viewport}`)
}

assert.match(screenshotSpec, /launcherScreenshotMatrix/)
assert.match(screenshotSpec, /page\.screenshot/)
assert.match(screenshotSpec, /evidence\//)
assert.doesNotMatch(screenshotSpec, /toHaveScreenshot|update-snapshot/)
assert.match(screenshotConfig, /workers: 1/)
assert.match(screenshotConfig, /deviceScaleFactor: 1/)
assert.match(screenshotConfig, /browserName: 'chromium'/)
assert.match(screenshotConfig, /npm run build && npm run preview/)
assert.match(lobbyRoomConfig, /browserName: 'chromium'/)
assert.match(lobbyRoomConfig, /npm run build && npm run preview/)
assert.match(lobbyRoomConfig, /ui-v2\.html#\/lobby/)
assert.match(lobbyRoomConfig, /timeout: 60_000/)
assert.match(viteConfig, /const backendProxy = \{/)
assert.match(viteConfig, /['"]\/api['"]/)
assert.match(viteConfig, /['"]\/socket\.io['"]/)
assert.match(viteConfig, /ws: true/)
assert.match(viteConfig, /server:[\s\S]*proxy: backendProxy/)
assert.match(viteConfig, /preview:[\s\S]*proxy: backendProxy/)
assert.match(packageJson, /test:launcher-screenshots/)
assert.match(packageJson, /test:lobby-room/)
assert.match(packageJson, /browser-env:check/)

console.log('launcher visual audit self-test passed')

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
