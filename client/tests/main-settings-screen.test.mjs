import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')

const screenSource = read('client/src/pages/main/MainScreen.tsx')
const screenCss = read('client/src/pages/main/MainScreen.module.css')
const fixtureSource = read('client/src/fixtures/main/mainFixtures.ts')
const gallerySource = read('client/src/dev/state-gallery/StateGallery.tsx')
const galleryFixturesSource = read('client/src/dev/state-gallery/fixtures.ts')
const appSource = read('client/src/app/AppV2.tsx')

assert.equal(statSync(join(repoRoot, 'client/src/pages/main/MainScreen.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/pages/main/MainScreen.module.css')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/fixtures/main/mainFixtures.ts')).isFile(), true)

for (const state of [
  'systemAvatar',
  'avatarGenerating',
  'avatarReady',
  'avatarFailed',
  'assetToast',
  'settingsOpen',
]) {
  assert.match(screenSource, new RegExp(`['"]${state}['"]`), `MainScreen missing state ${state}`)
  assert.match(fixtureSource, new RegExp(`state: ['"]${state}['"]`), `fixture missing main state ${state}`)
}

for (const state of [
  'default',
  'issuing',
  'issued',
  'expired',
  'invalid',
  'submitting',
  'serverError',
]) {
  assert.match(screenSource, new RegExp(`['"]${state}['"]`), `Settings modal missing state ${state}`)
  assert.match(fixtureSource, new RegExp(`state: ['"]${state}['"]`), `fixture missing settings state ${state}`)
}

for (const copy of [
  '메인',
  '게임하기',
  '에셋 만들기',
  '내 창고',
  '설정 열기',
  '장착한 아바타',
  '기본 아바타 · 졸라맨',
  '아바타 생성 중 · 예상 2~4분',
  '아바타 생성 실패',
  '설정',
  '소리',
  'BGM 볼륨',
  '효과음 볼륨',
  '음소거',
  '닉네임 변경',
  '닉네임 저장',
  '기기 연동',
  '연동 코드 발급',
  '연동 코드',
  '5분 안에 다른 기기에서 입력해주세요.',
  '예: TIGER-3392',
  '코드로 불러오기',
  '사용할 수 없는 코드예요.',
  '만료된 코드예요. 새 코드를 발급해주세요.',
]) {
  assert.match(screenSource + fixtureSource, new RegExp(escapeRegExp(copy)), `missing Korean copy: ${copy}`)
}

assert.match(screenSource, /<LauncherShell/)
assert.match(screenSource, /<AvatarPanel/)
assert.match(screenSource, /sourceImageUrl/)
assert.match(screenSource, /className=\{styles\.avatarImage\}/)
assert.match(screenSource, /<IconButton/)
assert.match(screenSource, /<SettingsModal/)
assert.match(screenSource, /<Modal/)
assert.match(screenSource, /<Toast/)
assert.match(screenSource, /data-v2-screen="s2-main"/)
assert.match(screenSource, /data-v2-component="main-screen"/)
assert.match(screenSource, /data-v2-component="avatar-panel"/)
assert.match(screenSource, /data-v2-component="settings-modal"/)
assert.match(screenSource, /data-v2-component="settings-issue-code"/)
assert.match(screenSource, /data-v2-component="settings-consume-code"/)

for (const callback of [
  'onNavigateLobby',
  'onOpenAssetStudio',
  'onOpenWarehouse',
  'onOpenSettings',
  'onCloseSettings',
  'onDismissAssetToast',
  'onChangeBgmVolume',
  'onChangeSfxVolume',
  'onToggleMute',
  'onChangeNickname',
  'onSaveNickname',
  'onIssueDeviceCode',
  'onChangeDeviceCode',
  'onConsumeDeviceCode',
]) {
  assert.match(screenSource, new RegExp(callback), `MainScreen missing callback ${callback}`)
}

for (const fixtureId of [
  's2-main-system-avatar',
  's2-main-avatar-generating',
  's2-main-avatar-ready',
  's2-main-avatar-failed',
  's2-main-asset-toast',
  's2-main-settings-open',
  's2c-settings-default',
  's2c-settings-issuing',
  's2c-settings-issued',
  's2c-settings-expired',
  's2c-settings-invalid',
  's2c-settings-submitting',
  's2c-settings-server-error',
]) {
  assert.match(fixtureSource, new RegExp(`id: ['"]${fixtureId}['"]`), `missing fixture ${fixtureId}`)
}

assert.match(galleryFixturesSource, /mainScreenFixtures\.map/)
assert.match(galleryFixturesSource, /mainFixtureId: fixture\.id/)
assert.match(gallerySource, /<MainScreen/)
assert.match(gallerySource, /selectedCase\.mainFixtureId/)
assert.match(appSource, /case 'main':/)
assert.match(appSource, /<MainController \/>/)

assert.match(screenCss, /min-height: 720px/)
assert.match(screenCss, /grid-template-columns: minmax\(0, 1\.2fr\) minmax\(320px, 420px\)/)
assert.match(screenCss, /@media \(max-width: 900px\)/)

const forbiddenImportPattern = /(zustand|appStore|localStorage|realtime|socket|api\/|net\/|phaser|SessionPort|StoragePort)/i
const rawHexPattern = /(^|[^A-Za-z0-9])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![A-Za-z0-9])/
const rawColorFunctionPattern = /\brgba?\(/

for (const [name, source] of [
  ['MainScreen.tsx', screenSource],
  ['MainScreen.module.css', screenCss],
  ['mainFixtures.ts', fixtureSource],
]) {
  assert.doesNotMatch(source, forbiddenImportPattern, `${name} has forbidden runtime import reference`)
  assert.doesNotMatch(source, rawHexPattern, `${name} has raw hex usage`)
  assert.doesNotMatch(source, rawColorFunctionPattern, `${name} has raw rgb/rgba usage`)
}

console.log('main/settings screen contract self-test passed')

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
