import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')

const screenSource = read('client/src/pages/login/LoginScreen.tsx')
const screenCss = read('client/src/pages/login/LoginScreen.module.css')
const fixtureSource = read('client/src/fixtures/login/loginFixtures.ts')
const uiLabSource = read('client/src/dev/ui-lab/UiLab.tsx')
const gallerySource = read('client/src/dev/state-gallery/StateGallery.tsx')
const galleryFixturesSource = read('client/src/dev/state-gallery/fixtures.ts')

assert.equal(statSync(join(repoRoot, 'client/src/pages/login/LoginScreen.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/pages/login/LoginScreen.module.css')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/fixtures/login/loginFixtures.ts')).isFile(), true)

for (const state of [
  'boot',
  'default',
  'emptyNickname',
  'tooLong',
  'submitting',
  'serverError',
  'expiredSession',
]) {
  assert.match(screenSource, new RegExp(`['"]${state}['"]`), `LoginScreen missing state ${state}`)
  assert.match(fixtureSource, new RegExp(`state: ['"]${state}['"]`), `fixture missing state ${state}`)
  assert.match(uiLabSource, new RegExp(`['"]${state}['"]`), `UI Lab missing state ${state}`)
}

for (const copy of [
  '릴레이 맵 메이커',
  '멀티플레이어 AI 릴레이 맵 제작 게임',
  '닉네임',
  '닉네임을 입력하세요',
  '시작하기',
  '닉네임은 1~12자까지 입력할 수 있어요.',
  '닉네임을 입력해주세요.',
  '닉네임은 12자 이하로 입력해주세요.',
  '시작할 수 없어요. 다시 시도해주세요.',
  '세션이 만료되었어요. 다시 시작해주세요.',
]) {
  assert.match(screenSource, new RegExp(escapeRegExp(copy)), `LoginScreen missing Korean copy: ${copy}`)
}

assert.match(screenSource, /<LauncherShell/)
assert.match(screenSource, /layout="centered"/)
assert.match(screenSource, /<TextField/)
assert.match(screenSource, /<Button/)
assert.match(screenSource, /data-v2-screen="s1-login"/)
assert.match(screenSource, /data-v2-component="login-form"/)
assert.match(screenSource, /data-v2-component="login-error"/)
assert.match(screenSource, /data-v2-component="login-submit"/)
assert.match(screenSource, /id=\{nicknameInputId\}/)
assert.match(screenSource, /aria-describedby=\{errorMessage \? nicknameErrorId : undefined\}/)
assert.match(screenSource, /aria-invalid=\{Boolean\(errorMessage\) \|\| undefined\}/)
assert.match(screenSource, /aria-live="polite"/)

assert.match(screenSource, /onSubmit=\{handleSubmit\}/)
assert.match(screenSource, /event\.preventDefault\(\)/)
assert.match(screenSource, /onSubmitNickname\(nickname\)/)
assert.match(screenSource, /type="submit"/)
assert.match(screenSource, /disabled=\{!canSubmit\}/)
assert.match(screenSource, /loading=\{state === 'submitting'\}/)

assert.match(screenCss, /\.errorArea/)
assert.match(screenCss, /min-height: var\(--spacing-6\)/)
assert.match(screenCss, /min-height: 720px/)
assert.match(screenCss, /width: min\(calc\(var\(--spacing-16\) \* 7 \+ var\(--spacing-8\)\), calc\(100vw - var\(--spacing-8\)\)\)/)
assert.match(screenCss, /\.heroPanel/)
assert.match(screenCss, /\.copyBlock/)
assert.match(screenCss, /\.nicknameField/)
assert.match(screenCss, /min-height: calc\(var\(--spacing-16\) \+ var\(--spacing-1\)\)/)
assert.match(screenCss, /\.submitButton\.submitButton/)
assert.match(screenCss, /min-height: calc\(var\(--spacing-16\) \+ var\(--spacing-2\)\)/)
assert.match(screenCss, /font-size: var\(--typography-size-title-sm\)/)
assert.doesNotMatch(screenSource, /previewBlock|previewStage|previewStats|previewTile/)
assert.doesNotMatch(screenCss, /previewBlock|previewStage|previewStats|previewTile/)
assert.doesNotMatch(screenCss, /login-orb-drift/)
assert.match(screenCss, /@media \(max-width: 520px\)/)

for (const fixtureId of [
  's1-login-boot',
  's1-login-default',
  's1-login-empty-nickname',
  's1-login-too-long',
  's1-login-submitting',
  's1-login-server-error',
  's1-login-expired-session',
]) {
  assert.match(fixtureSource, new RegExp(`id: ['"]${fixtureId}['"]`), `missing fixture ${fixtureId}`)
}

assert.match(galleryFixturesSource, /loginScreenFixtures\.map/)
assert.match(galleryFixturesSource, /loginFixtureId: fixture\.id/)
assert.match(uiLabSource, /'Screen Views'/)
assert.match(uiLabSource, /<LoginScreen/)
assert.match(uiLabSource, /loginScreenFixtures/)
assert.match(gallerySource, /<LoginScreen/)
assert.match(gallerySource, /selectedCase\.loginFixtureId/)
assert.match(gallerySource, /data-v2-gallery-case=\{selectedCase\.id\}/)

const forbiddenImportPattern = /(zustand|appStore|localStorage|realtime|socket|api\/|net\/|phaser)/i
const rawHexPattern = /(^|[^A-Za-z0-9])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![A-Za-z0-9])/
const rawColorFunctionPattern = /\brgba?\(/

for (const [name, source] of [
  ['LoginScreen.tsx', screenSource],
  ['LoginScreen.module.css', screenCss],
  ['loginFixtures.ts', fixtureSource],
]) {
  assert.doesNotMatch(source, forbiddenImportPattern, `${name} has forbidden runtime import reference`)
  assert.doesNotMatch(source, rawHexPattern, `${name} has raw hex usage`)
  assert.doesNotMatch(source, rawColorFunctionPattern, `${name} has raw rgb/rgba usage`)
}

console.log('login screen contract self-test passed')

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
