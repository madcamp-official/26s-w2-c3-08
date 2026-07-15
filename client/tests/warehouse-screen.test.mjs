import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')

const screenSource = read('client/src/pages/warehouse/WarehouseScreen.tsx')
const screenCss = read('client/src/pages/warehouse/WarehouseScreen.module.css')
const fixtureSource = read('client/src/fixtures/warehouse/warehouseFixtures.ts')
const gallerySource = read('client/src/dev/state-gallery/StateGallery.tsx')
const galleryFixturesSource = read('client/src/dev/state-gallery/fixtures.ts')
const appSource = read('client/src/app/AppV2.tsx')
const modalSource = read('client/src/design-system/components/Modal/Modal.tsx')

assert.equal(statSync(join(repoRoot, 'client/src/pages/warehouse/WarehouseScreen.tsx')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/pages/warehouse/WarehouseScreen.module.css')).isFile(), true)
assert.equal(statSync(join(repoRoot, 'client/src/fixtures/warehouse/warehouseFixtures.ts')).isFile(), true)

for (const component of [
  'WarehouseScreen',
  'AssetCard',
  'AssetPreview',
  'AssetReviewModal',
  'CooldownButton',
]) {
  assert.match(screenSource, new RegExp(`export function ${component}`), `missing component ${component}`)
}

for (const state of [
  'loading',
  'avatarEmpty',
  'componentEmpty',
  'queued',
  'generating',
  'ready',
  'failed',
  'mixed',
  'details',
  'cooldown',
  'offline',
  'reconnecting',
  'malformedData',
]) {
  assert.match(screenSource, new RegExp(`['"]${state}['"]`), `WarehouseScreen missing state ${state}`)
  assert.match(fixtureSource, new RegExp(`state: ['"]${state}['"]`), `fixture missing state ${state}`)
}

for (const fixtureId of [
  's2b-warehouse-loading',
  's2b-warehouse-avatar-empty',
  's2b-warehouse-component-empty',
  's2b-warehouse-queued',
  's2b-warehouse-generating',
  's2b-warehouse-ready',
  's2b-warehouse-failed',
  's2b-warehouse-mixed',
  's2b-warehouse-details',
  's2b-warehouse-cooldown',
  's2b-warehouse-offline',
  's2b-warehouse-reconnecting',
  's2b-warehouse-malformed-data',
]) {
  assert.match(fixtureSource, new RegExp(`id: ['"]${fixtureId}['"]`), `missing fixture ${fixtureId}`)
}

for (const copy of [
  '내 창고',
  '아바타',
  '컴포넌트 에셋',
  '전체',
  '플랫폼',
  '장애물',
  '몬스터',
  '배경',
  '내가 만든 에셋',
  '사용 가능',
  '작업 중',
  '실패',
  '아직 만든 아바타가 없어요.',
  '아직 만든 컴포넌트 에셋이 없어요.',
  '아바타 만들기',
  '에셋 만들기',
  '장착',
  '장착 중',
  '재생성',
  '그림·속성 수정하기',
  '다시 시도',
  '생성이 끝난 뒤 사용할 수 있어요.',
  '대기 중 · 예상 2~4분',
  '생성 중 · 남은 시간 약 3분',
  '서버 응답 형식이 올바르지 않아요.',
]) {
  assert.match(screenSource + fixtureSource, new RegExp(escapeRegExp(copy)), `missing Korean copy: ${copy}`)
}

assert.match(screenSource, /<LauncherShell/)
assert.match(screenSource, /<Tabs/)
assert.match(screenSource, /<FilterChip/)
assert.match(screenSource, /<Badge/)
assert.match(screenSource, /<ProgressBar/)
assert.match(screenSource, /<LoadingState/)
assert.match(screenSource, /<EmptyState/)
assert.match(screenSource, /<ErrorState/)
assert.match(screenSource, /<ConnectionState/)
assert.match(screenSource, /<Modal/)
assert.match(screenSource, /data-v2-screen="s2b-warehouse"/)
assert.match(screenSource, /data-v2-component="warehouse-screen"/)
assert.match(screenSource, /data-v2-component="asset-card"/)
assert.match(screenSource, /data-v2-component="asset-preview"/)
assert.match(screenSource, /sourceImageUrl/)
assert.match(screenSource, /className=\{styles\.previewImage\}/)
assert.match(screenSource, /data-v2-component="asset-review-modal"/)
assert.match(screenSource, /data-v2-component="cooldown-button"/)
assert.match(screenSource, /const canUse = asset\.status === 'ready'/)
assert.match(screenSource, /const canUseAsset = asset\?\.status === 'ready'/)
assert.match(screenSource, /disabled=\{!canUseAsset/)
assert.match(screenSource, /role="tabpanel"/)
assert.match(screenSource, /role="img"/)

for (const callback of [
  'onGoMain',
  'onChangeTab',
  'onChangeFilter',
  'onOpenAsset',
  'onCloseDetails',
  'onSelectReviewAction',
  'onEquipAvatar',
  'onRetryAsset',
  'onRegenerateAction',
  'onEditAsset',
  'onCreateAvatar',
  'onCreateComponent',
  'onRefresh',
]) {
  assert.match(screenSource + fixtureSource, new RegExp(callback), `missing callback ${callback}`)
}

assert.match(screenSource, /export type WarehouseAssetCategory = 'avatar' \| 'platform' \| 'obstacle' \| 'monster' \| 'background'/)
assert.doesNotMatch(screenSource, /WarehouseFilter = .*item/)
assert.doesNotMatch(fixtureSource, /category: ['"]item['"]/)
assert.match(screenSource, /warehouseFilters/)
assert.match(screenSource, /value: 'platform'/)
assert.match(screenSource, /value: 'obstacle'/)
assert.match(screenSource, /value: 'monster'/)
assert.match(screenSource, /value: 'background'/)

assert.match(galleryFixturesSource, /warehouseScreenFixtures\.map/)
assert.match(galleryFixturesSource, /warehouseFixtureId: fixture\.id/)
assert.match(gallerySource, /<WarehouseScreen/)
assert.match(gallerySource, /selectedCase\.warehouseFixtureId/)
assert.match(appSource, /case 'warehouse':/)
assert.match(appSource, /<WarehouseController/)
assert.doesNotMatch(appSource, /getWarehouseScreenFixtureForRoute/)

assert.match(modalSource, /restoreFocusRef/)
assert.match(modalSource, /event\.key === 'Escape'/)
assert.match(modalSource, /getFocusableElements/)
assert.match(screenCss, /min-height: 720px/)
assert.match(screenCss, /grid-template-columns: repeat\(4, minmax\(220px, 1fr\)\)/)
assert.match(screenCss, /@media \(max-width: 1100px\)/)
assert.match(screenCss, /@media \(max-width: 900px\)/)

const forbiddenImportPattern = /(zustand|appStore|localStorage|realtime|socket|api\/|net\/|phaser|SessionPort|StoragePort|AssetPort|DeviceLinkPort)/i
const rawHexPattern = /(^|[^A-Za-z0-9])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![A-Za-z0-9])/
const rawColorFunctionPattern = /\brgba?\(/

for (const [name, source] of [
  ['WarehouseScreen.tsx', screenSource],
  ['WarehouseScreen.module.css', screenCss],
  ['warehouseFixtures.ts', fixtureSource],
]) {
  assert.doesNotMatch(source, forbiddenImportPattern, `${name} has forbidden runtime import reference`)
  assert.doesNotMatch(source, rawHexPattern, `${name} has raw hex usage`)
  assert.doesNotMatch(source, rawColorFunctionPattern, `${name} has raw rgb/rgba usage`)
}

console.log('warehouse screen contract self-test passed')

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
