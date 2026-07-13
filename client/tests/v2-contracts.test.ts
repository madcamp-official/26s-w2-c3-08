import assert from 'node:assert/strict'

import {
  AVATAR_VISIBLE_HEIGHT,
  AVATAR_VISIBLE_WIDTH,
  AVATAR_WORKSPACE_HEIGHT,
  AVATAR_WORKSPACE_SCALE,
  AVATAR_WORKSPACE_WIDTH,
  EDITOR_BOARD_COLS,
  EDITOR_BOARD_ROWS,
  EDITOR_CELL_PX,
  SPRITE_REGEN_COOLDOWN_MS,
} from '../../shared/constants.ts'
import {
  assetCategorySchema,
  assetJobSchema,
  assetSchema,
  createAvatarAssetRequestSchema,
  createComponentAssetRequestSchema,
  createUserAssetRequestSchema,
  racePositionPayloadSchema,
  roomPhaseChangedPayloadSchema,
  typedApiErrorSchema,
  userCreatableComponentCategorySchema,
} from '../../shared/schemas/index.ts'
import type { PortResult } from '../src/domain/ports/index.ts'
import {
  ConfigurationError,
  parseDataMode,
  parseRealtimeMode,
  resolveV2ModeConfig,
} from '../src/infrastructure/config/modeConfig.ts'

assert.equal(AVATAR_VISIBLE_WIDTH, 256)
assert.equal(AVATAR_VISIBLE_HEIGHT, 512)
assert.equal(AVATAR_WORKSPACE_SCALE, 3)
assert.equal(AVATAR_WORKSPACE_WIDTH, 768)
assert.equal(AVATAR_WORKSPACE_HEIGHT, 1536)
assert.equal(EDITOR_BOARD_COLS, 24)
assert.equal(EDITOR_BOARD_ROWS, 10)
assert.equal(EDITOR_CELL_PX, 32)
assert.equal(SPRITE_REGEN_COOLDOWN_MS, 5 * 60 * 1000)

for (const category of ['platform', 'obstacle', 'monster', 'background'] as const) {
  assert.equal(userCreatableComponentCategorySchema.parse(category), category)
}

assert.throws(() => userCreatableComponentCategorySchema.parse('avatar'))
assert.throws(() => userCreatableComponentCategorySchema.parse('item'))
assert.equal(assetCategorySchema.parse('item'), 'item')

const avatarRequest = {
  userId: 'user-1',
  category: 'avatar',
  name: 'hero',
  description: '',
  image: 'data:image/png;base64,avatar',
  attrs: {},
  widthCells: null,
  heightCells: null,
}

assert.equal(createAvatarAssetRequestSchema.parse(avatarRequest).category, 'avatar')
assert.equal(createUserAssetRequestSchema.parse(avatarRequest).category, 'avatar')

const platformRequest = {
  userId: 'user-1',
  category: 'platform',
  name: 'grass',
  description: '',
  image: 'data:image/png;base64,platform',
  attrs: { collisionMode: 'solid' },
  widthCells: 2,
  heightCells: 1,
}

assert.equal(createComponentAssetRequestSchema.parse(platformRequest).category, 'platform')
assert.equal(createUserAssetRequestSchema.parse(platformRequest).category, 'platform')
assert.throws(() => createComponentAssetRequestSchema.parse(avatarRequest))
assert.throws(() =>
  createComponentAssetRequestSchema.parse({
    ...platformRequest,
    category: 'item',
  }),
)

const systemItemAsset = {
  id: 'system-item-speed',
  creatorId: null,
  isSystem: true,
  category: 'item',
  name: 'speed item',
  description: 'system item',
  attrs: { effect: 'speed-boost' },
  colliderType: 'none',
  widthCells: 1,
  heightCells: 1,
  sourceImageUrl: '',
  remixOfId: null,
  status: 'ready',
  isPublic: false,
  createdAt: new Date(0).toISOString(),
  sprites: [
    {
      action: 'static',
      status: 'ready',
      sheetUrl: null,
      frameCount: 1,
      lastRegenAt: null,
    },
  ],
}

assert.equal(assetSchema.parse(systemItemAsset).category, 'item')

const systemItemBeforeParse = JSON.stringify(systemItemAsset)
assetSchema.parse(systemItemAsset)
assert.equal(JSON.stringify(systemItemAsset), systemItemBeforeParse)

const systemItemWithUnknownField = {
  ...systemItemAsset,
  extraRuntimeField: 'ignored-by-contract',
}
const parsedSystemItem = assetSchema.parse(systemItemWithUnknownField)
assert.equal('extraRuntimeField' in parsedSystemItem, false)
assert.equal('extraRuntimeField' in systemItemWithUnknownField, true)

const nestedSpriteError = assetSchema.safeParse({
  ...systemItemAsset,
  sprites: [
    {
      ...systemItemAsset.sprites[0],
      action: 'jump',
    },
  ],
})
assert.equal(nestedSpriteError.success, false)
if (!nestedSpriteError.success) {
  assert.equal(nestedSpriteError.error.schemaName, 'assetSchema')
  assert.equal(nestedSpriteError.error.issues[0]?.path, 'sprites[0].action')
}

assert.equal(assetSchema.safeParse(null).success, false)
assert.equal(assetSchema.safeParse([]).success, false)
assert.equal(
  createComponentAssetRequestSchema.safeParse({
    ...platformRequest,
    attrs: [],
  }).success,
  false,
)

const safePlatformRequest = createComponentAssetRequestSchema.safeParse(platformRequest)
assert.equal(safePlatformRequest.success, true)
if (safePlatformRequest.success) {
  assert.deepEqual(safePlatformRequest.data, createComponentAssetRequestSchema.parse(platformRequest))
}

assert.equal(parseDataMode('mock'), 'mock')
assert.equal(parseDataMode('remote'), 'remote')
assert.equal(parseRealtimeMode('local'), 'local')
assert.equal(parseRealtimeMode('remote'), 'remote')
assert.equal(parseDataMode(undefined, { isProduction: false }), 'mock')
assert.equal(parseRealtimeMode(undefined, { isProduction: false }), 'local')
assert.throws(() => parseDataMode(undefined, { isProduction: true }), ConfigurationError)
assert.throws(() => parseRealtimeMode(undefined, { isProduction: true }), ConfigurationError)
assert.throws(() => resolveV2ModeConfig({}, { isProduction: true }), ConfigurationError)
assert.throws(() => parseDataMode('api'), ConfigurationError)
assert.throws(() => parseRealtimeMode('broadcast'), ConfigurationError)

const remoteConfig = resolveV2ModeConfig(
  { VITE_DATA_MODE: 'remote', VITE_REALTIME_MODE: 'remote' },
  { isProduction: false },
)

assert.equal(remoteConfig.apiAdapterKind, 'remoteApi')
assert.equal(remoteConfig.realtimeAdapterKind, 'remoteRealtime')
assert.equal(remoteConfig.allowMockApiFallback, false)
assert.equal(remoteConfig.allowLocalRealtimeFallback, false)

for (const config of [
  resolveV2ModeConfig({ VITE_DATA_MODE: 'mock', VITE_REALTIME_MODE: 'local' }),
  resolveV2ModeConfig({ VITE_DATA_MODE: 'mock', VITE_REALTIME_MODE: 'remote' }),
  resolveV2ModeConfig({ VITE_DATA_MODE: 'remote', VITE_REALTIME_MODE: 'local' }),
  remoteConfig,
]) {
  assert.equal(config.allowMockApiFallback, false)
  assert.equal(config.allowLocalRealtimeFallback, false)
}

assert.deepEqual(assetJobSchema.parse({ id: 'job-1', status: 'queued' }), {
  id: 'job-1',
  status: 'queued',
  targetType: undefined,
  outputAssetId: undefined,
  errorCode: undefined,
  errorMessage: undefined,
})
assert.throws(() => assetJobSchema.parse({ id: 'job-1', status: 'PENDING_RETRY' }))
const missingIdJob = assetJobSchema.safeParse({ status: 'queued' })
assert.equal(missingIdJob.success, false)
if (!missingIdJob.success) {
  assert.equal(missingIdJob.error.issues[0]?.path, 'id')
}

assert.equal(
  typedApiErrorSchema.parse({
    kind: 'server_unavailable',
    code: 'SERVER_DOWN',
    message: 'server unavailable',
    retryable: true,
    source: 'api',
  }).kind,
  'server_unavailable',
)

const portFailure: PortResult<never> = {
  ok: false,
  error: typedApiErrorSchema.parse({
    kind: 'conflict',
    code: 'DUPLICATE_SUBMIT',
    message: 'duplicate submit',
    retryable: false,
  }),
}
assert.equal(portFailure.ok, false)
if (!portFailure.ok) {
  assert.equal(portFailure.error.kind, 'conflict')
}

assert.equal(
  roomPhaseChangedPayloadSchema.parse({
    roomId: 'room-1',
    phase: 'racing',
    phaseEndsAt: null,
    isOvertime: true,
  }).phase,
  'racing',
)

assert.equal(
  racePositionPayloadSchema.parse({
    roomId: 'room-1',
    userId: 'user-1',
    x: 10,
    y: 20,
    vx: 1,
    vy: 0,
    state: 'running',
    progress: 42,
    clientTime: 1000,
  }).progress,
  42,
)

assert.throws(() =>
  racePositionPayloadSchema.parse({
    roomId: 'room-1',
    userId: 'user-1',
    x: Number.NaN,
    y: 20,
    vx: 1,
    vy: 0,
    state: 'running',
    progress: 42,
    clientTime: 1000,
  }),
)
assert.throws(() =>
  racePositionPayloadSchema.parse({
    roomId: 'room-1',
    userId: 'user-1',
    x: 10,
    y: Infinity,
    vx: 1,
    vy: 0,
    state: 'running',
    progress: 42,
    clientTime: 1000,
  }),
)

console.log('v2 contract self-test passed')
