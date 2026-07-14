// Frontend V2 shared contract schemas.
//
// This module intentionally has no runtime dependency. It provides a small
// parse/safeParse surface that can later be wrapped by zod if shared package
// dependencies are formalized.

export interface SchemaIssue {
  path: string
  message: string
}

export class SchemaValidationError extends Error {
  readonly schemaName: string
  readonly issues: SchemaIssue[]

  constructor(schemaName: string, issues: SchemaIssue[]) {
    super(`${schemaName} validation failed`)
    this.name = 'SchemaValidationError'
    this.schemaName = schemaName
    this.issues = issues
  }
}

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: SchemaValidationError }

export interface ContractSchema<T> {
  parse(value: unknown): T
  safeParse(value: unknown): SafeParseResult<T>
}

export const assetCategoryValues = [
  'avatar',
  'platform',
  'obstacle',
  'monster',
  'background',
  'item',
] as const

export const userCreatableComponentCategoryValues = [
  'platform',
  'obstacle',
  'monster',
  'background',
] as const

export const assetStatusValues = ['queued', 'generating', 'ready', 'failed'] as const

export const roomPhaseValues = [
  'lobby',
  'building',
  'validating',
  'merging',
  'racing',
  'finished',
] as const

export const assetSpriteActionValues = ['idle', 'walk', 'onair', 'static'] as const

export const colliderTypeValues = ['rect', 'slope', 'none'] as const

export const apiErrorKindValues = [
  'validation',
  'authentication',
  'authorization',
  'not_found',
  'conflict',
  'rate_limit',
  'asset_job_failure',
  'offline',
  'reconnecting',
  'server_unavailable',
  'malformed_response',
] as const

export const apiErrorSourceValues = [
  'api',
  'realtime',
  'storage',
  'drawing',
  'phaser',
] as const

export const realtimeConnectionStatusValues = [
  'idle',
  'connecting',
  'connected',
  'reconnecting',
  'offline',
  'error',
  'local',
] as const

export type AssetCategory = (typeof assetCategoryValues)[number]
export type UserCreatableComponentCategory =
  (typeof userCreatableComponentCategoryValues)[number]
export type AssetStatus = (typeof assetStatusValues)[number]
export type RoomPhase = (typeof roomPhaseValues)[number]
export type AssetSpriteAction = (typeof assetSpriteActionValues)[number]
export type ColliderType = (typeof colliderTypeValues)[number]
export type ApiErrorKind = (typeof apiErrorKindValues)[number]
export type ApiErrorSource = (typeof apiErrorSourceValues)[number]
export type RealtimeConnectionStatus = (typeof realtimeConnectionStatusValues)[number]

export type AssetAttrs = Record<string, string | number | boolean | null>

export interface Session {
  id: string
  nickname: string
  token: string
  avatarAssetId: string | null
}

export interface AssetSprite {
  action: AssetSpriteAction
  status: AssetStatus
  sheetUrl: string | null
  frameCount: number | null
  lastRegenAt: string | null
}

export interface Asset {
  id: string
  creatorId: string | null
  isSystem: boolean
  category: AssetCategory
  name: string
  description: string
  attrs: AssetAttrs
  colliderType: ColliderType
  widthCells: number | null
  heightCells: number | null
  sourceImageUrl: string
  remixOfId: string | null
  status: AssetStatus
  isPublic: boolean
  createdAt: string
  sprites: AssetSprite[]
}

export interface AssetJob {
  id: string
  status: AssetStatus
  targetType?: string
  outputAssetId?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

export interface CreateAvatarAssetRequest {
  userId: string
  category: 'avatar'
  name: string
  description: string
  image: string
  attrs: AssetAttrs
  widthCells: null
  heightCells: null
  remixOfId?: string | null
}

export interface CreateComponentAssetRequest {
  userId: string
  category: UserCreatableComponentCategory
  name: string
  description: string
  image: string
  attrs: AssetAttrs
  widthCells: number
  heightCells: number
  remixOfId?: string | null
}

export type CreateUserAssetRequest =
  | CreateAvatarAssetRequest
  | CreateComponentAssetRequest

export interface RoomSummary {
  id: string
  name: string
  hostId: string | null
  hostNickname: string
  isPublic: boolean
  players: number
  maxPlayers: number
  phase: RoomPhase
  elapsedSeconds: number
  phaseEndsAt: string | null
}

export interface RoomPlayer {
  id: string
  nickname: string
  isHost: boolean
  isReady: boolean
  validationCleared: boolean
  raceProgress: number
  raceFinishedAtMs: number | null
  raceDistanceToGoal: number
}

export interface MapPoint {
  x: number
  y: number
}

export interface MapSegmentMetadata {
  id: string
  roomId: string
  creatorId: string
  segmentHash: string
  isValidated: boolean
  submittedAt: string
  validatedAt: string | null
  clearTimeMs: number | null
}

export interface RaceResultPlayer {
  userId: string
  nickname: string
  isHost: boolean
  isReady: boolean
  validationCleared: boolean
  raceProgress: number
  raceFinishedAtMs: number | null
  raceDistanceToGoal: number
  rank: number
}

export interface RaceResult {
  roomId: string
  players: RaceResultPlayer[]
}

export interface TypedApiError {
  kind: ApiErrorKind
  code: string
  message: string
  retryable: boolean
  fieldErrors?: Record<string, string[]>
  source?: ApiErrorSource
}

export interface RoomPhaseChangedPayload {
  roomId: string
  phase: RoomPhase
  phaseEndsAt: string | null
  isOvertime?: boolean
  isFinishCountdown?: boolean
}

export interface RoomTimerTickPayload {
  roomId: string
  phase: RoomPhase
  remainingMs: number
}

export interface RealtimeRoomPlayer {
  userId: string
  nickname: string
  isHost: boolean
  isReady: boolean
  validationCleared: boolean
  raceProgress: number
  raceFinishedAtMs: number | null
  raceDistanceToGoal: number
  rank?: number
}

export interface RealtimeRoomSnapshot {
  roomId: string
  phase: RoomPhase
  phaseEndsAt: string | null
  players: RealtimeRoomPlayer[]
  submittedSegmentIds?: Record<string, string>
  hasOvertime?: boolean
}

export interface RacePositionPayload {
  roomId: string
  userId: string
  x: number
  y: number
  vx: number
  vy: number
  state: string
  progress: number
  clientTime: number
}

export interface RaceFinishedPayload {
  roomId: string
  userId: string
  finishTimeMs: number
}

export const assetCategorySchema = enumSchema('assetCategorySchema', assetCategoryValues)

export const userCreatableComponentCategorySchema = enumSchema(
  'userCreatableComponentCategorySchema',
  userCreatableComponentCategoryValues,
)

export const assetStatusSchema = enumSchema('assetStatusSchema', assetStatusValues)

export const assetSchema = defineSchema<Asset>('assetSchema', (value, schemaName) => {
  const record = asRecord(value, schemaName)

  return {
    id: readRequiredString(record, 'id', schemaName),
    creatorId: readNullableString(record, 'creatorId', schemaName),
    isSystem: readRequiredBoolean(record, 'isSystem', schemaName),
    category: assetCategorySchema.parse(record.category),
    name: readRequiredString(record, 'name', schemaName),
    description: readRequiredText(record, 'description', schemaName),
    attrs: readAttrs(record.attrs, schemaName, 'attrs'),
    colliderType: parseEnumValue(record.colliderType, colliderTypeValues, schemaName, 'colliderType'),
    widthCells: readNullableInteger(record, 'widthCells', schemaName, 1, 8),
    heightCells: readNullableInteger(record, 'heightCells', schemaName, 1, 8),
    sourceImageUrl: readRequiredText(record, 'sourceImageUrl', schemaName),
    remixOfId: readNullableString(record, 'remixOfId', schemaName),
    status: assetStatusSchema.parse(record.status),
    isPublic: readRequiredBoolean(record, 'isPublic', schemaName),
    createdAt: readRequiredString(record, 'createdAt', schemaName),
    sprites: readArray(record.sprites, schemaName, 'sprites').map((sprite, index) =>
      parseAssetSprite(sprite, schemaName, `sprites[${index}]`),
    ),
  }
})

export const assetJobSchema = defineSchema<AssetJob>('assetJobSchema', (value, schemaName) => {
  const record = asRecord(value, schemaName)

  return {
    id: readRequiredString(record, 'id', schemaName),
    status: assetStatusSchema.parse(record.status),
    targetType: readOptionalString(record, 'targetType', schemaName),
    outputAssetId: readOptionalNullableString(record, 'outputAssetId', schemaName),
    errorCode: readOptionalNullableString(record, 'errorCode', schemaName),
    errorMessage: readOptionalNullableString(record, 'errorMessage', schemaName),
  }
})

export const sessionSchema = defineSchema<Session>('sessionSchema', (value, schemaName) => {
  const record = asRecord(value, schemaName)

  return {
    id: readRequiredString(record, 'id', schemaName),
    nickname: readRequiredString(record, 'nickname', schemaName),
    token: readRequiredString(record, 'token', schemaName),
    avatarAssetId: readNullableString(record, 'avatarAssetId', schemaName),
  }
})

export const createAvatarAssetRequestSchema = defineSchema<CreateAvatarAssetRequest>(
  'createAvatarAssetRequestSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)
    const category = parseEnumValue(record.category, ['avatar'] as const, schemaName, 'category')

    return {
      userId: readRequiredString(record, 'userId', schemaName),
      category,
      name: readRequiredString(record, 'name', schemaName),
      description: readRequiredText(record, 'description', schemaName),
      image: readRequiredString(record, 'image', schemaName),
      attrs: readAttrs(record.attrs, schemaName, 'attrs'),
      widthCells: readExactNull(record, 'widthCells', schemaName),
      heightCells: readExactNull(record, 'heightCells', schemaName),
      remixOfId: readOptionalNullableString(record, 'remixOfId', schemaName),
    }
  },
)

export const createComponentAssetRequestSchema = defineSchema<CreateComponentAssetRequest>(
  'createComponentAssetRequestSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)

    return {
      userId: readRequiredString(record, 'userId', schemaName),
      category: userCreatableComponentCategorySchema.parse(record.category),
      name: readRequiredString(record, 'name', schemaName),
      description: readRequiredText(record, 'description', schemaName),
      image: readRequiredString(record, 'image', schemaName),
      attrs: readAttrs(record.attrs, schemaName, 'attrs'),
      widthCells: readRequiredInteger(record, 'widthCells', schemaName, 1, 8),
      heightCells: readRequiredInteger(record, 'heightCells', schemaName, 1, 8),
      remixOfId: readOptionalNullableString(record, 'remixOfId', schemaName),
    }
  },
)

export const createUserAssetRequestSchema = defineSchema<CreateUserAssetRequest>(
  'createUserAssetRequestSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)

    if (record.category === 'avatar') {
      return createAvatarAssetRequestSchema.parse(value)
    }

    if (userCreatableComponentCategoryValues.includes(record.category as never)) {
      return createComponentAssetRequestSchema.parse(value)
    }

    throw schemaError(schemaName, 'category', 'category is not user-creatable')
  },
)

export const roomSummarySchema = defineSchema<RoomSummary>(
  'roomSummarySchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)

    return {
      id: readRequiredString(record, 'id', schemaName),
      name: readRequiredString(record, 'name', schemaName),
      hostId: readNullableString(record, 'hostId', schemaName, true),
      hostNickname: readRequiredString(record, 'hostNickname', schemaName),
      isPublic: readRequiredBoolean(record, 'isPublic', schemaName),
      players: readRequiredInteger(record, 'players', schemaName, 0, 4),
      maxPlayers: readRequiredInteger(record, 'maxPlayers', schemaName, 2, 4),
      phase: parseEnumValue(record.phase, roomPhaseValues, schemaName, 'phase'),
      elapsedSeconds: readRequiredInteger(record, 'elapsedSeconds', schemaName, 0),
      phaseEndsAt: readNullableString(record, 'phaseEndsAt', schemaName, true),
    }
  },
)

export const roomPlayerSchema = defineSchema<RoomPlayer>('roomPlayerSchema', (value, schemaName) => {
  const record = asRecord(value, schemaName)

  return {
    id: readRequiredString(record, 'id', schemaName),
    nickname: readRequiredString(record, 'nickname', schemaName),
    isHost: readRequiredBoolean(record, 'isHost', schemaName),
    isReady: readRequiredBoolean(record, 'isReady', schemaName),
    validationCleared: readRequiredBoolean(record, 'validationCleared', schemaName),
    raceProgress: readRequiredFiniteNumber(record, 'raceProgress', schemaName, 0, 100),
    raceFinishedAtMs: readNullableFiniteNumber(record, 'raceFinishedAtMs', schemaName, 0),
    raceDistanceToGoal: readRequiredFiniteNumber(record, 'raceDistanceToGoal', schemaName, 0),
  }
})

export const mapSegmentMetadataSchema = defineSchema<MapSegmentMetadata>(
  'mapSegmentMetadataSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)

    return {
      id: readRequiredString(record, 'id', schemaName),
      roomId: readRequiredString(record, 'roomId', schemaName),
      creatorId: readRequiredString(record, 'creatorId', schemaName),
      segmentHash: readRequiredString(record, 'segmentHash', schemaName),
      isValidated: readRequiredBoolean(record, 'isValidated', schemaName),
      submittedAt: readRequiredString(record, 'submittedAt', schemaName),
      validatedAt: readNullableString(record, 'validatedAt', schemaName),
      clearTimeMs: readNullableFiniteNumber(record, 'clearTimeMs', schemaName, 0),
    }
  },
)

export const raceResultSchema = defineSchema<RaceResult>('raceResultSchema', (value, schemaName) => {
  const record = asRecord(value, schemaName)

  return {
    roomId: readRequiredString(record, 'roomId', schemaName),
    players: readArray(record.players, schemaName, 'players').map((player, index) =>
      parseRaceResultPlayer(player, schemaName, `players[${index}]`),
    ),
  }
})

export const typedApiErrorSchema = defineSchema<TypedApiError>(
  'typedApiErrorSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)
    const source =
      record.source === undefined
        ? undefined
        : parseEnumValue(record.source, apiErrorSourceValues, schemaName, 'source')

    return {
      kind: parseEnumValue(record.kind, apiErrorKindValues, schemaName, 'kind'),
      code: readRequiredString(record, 'code', schemaName),
      message: readRequiredString(record, 'message', schemaName),
      retryable: readRequiredBoolean(record, 'retryable', schemaName),
      fieldErrors:
        record.fieldErrors === undefined
          ? undefined
          : readFieldErrors(record.fieldErrors, schemaName, 'fieldErrors'),
      source,
    }
  },
)

export const realtimeConnectionStatusSchema = enumSchema(
  'realtimeConnectionStatusSchema',
  realtimeConnectionStatusValues,
)

export const assetJobUpdatedPayloadSchema = assetJobSchema

export const roomStateSnapshotSchema = defineSchema<RealtimeRoomSnapshot>(
  'roomStateSnapshotSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)
    const submittedSegmentIds =
      record.submittedSegmentIds === undefined
        ? undefined
        : readStringRecord(record.submittedSegmentIds, schemaName, 'submittedSegmentIds')

    return {
      roomId: readRequiredString(record, 'roomId', schemaName),
      phase: parseEnumValue(record.phase, roomPhaseValues, schemaName, 'phase'),
      phaseEndsAt: readNullableString(record, 'phaseEndsAt', schemaName),
      players: readArray(record.players, schemaName, 'players').map((player, index) =>
        parseRealtimeRoomPlayer(player, schemaName, `players[${index}]`),
      ),
      submittedSegmentIds,
      hasOvertime:
        record.hasOvertime === undefined
          ? undefined
          : readRequiredBoolean(record, 'hasOvertime', schemaName),
    }
  },
)

export const roomPhaseChangedPayloadSchema = defineSchema<RoomPhaseChangedPayload>(
  'roomPhaseChangedPayloadSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)

    return {
      roomId: readRequiredString(record, 'roomId', schemaName),
      phase: parseEnumValue(record.phase, roomPhaseValues, schemaName, 'phase'),
      phaseEndsAt: readNullableString(record, 'phaseEndsAt', schemaName),
      isOvertime:
        record.isOvertime === undefined
          ? undefined
          : readRequiredBoolean(record, 'isOvertime', schemaName),
      isFinishCountdown:
        record.isFinishCountdown === undefined
          ? undefined
          : readRequiredBoolean(record, 'isFinishCountdown', schemaName),
    }
  },
)

export const roomTimerTickPayloadSchema = defineSchema<RoomTimerTickPayload>(
  'roomTimerTickPayloadSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)

    return {
      roomId: readRequiredString(record, 'roomId', schemaName),
      phase: parseEnumValue(record.phase, roomPhaseValues, schemaName, 'phase'),
      remainingMs: readRequiredInteger(record, 'remainingMs', schemaName, 0),
    }
  },
)

export const racePositionPayloadSchema = defineSchema<RacePositionPayload>(
  'racePositionPayloadSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)

    return {
      roomId: readRequiredString(record, 'roomId', schemaName),
      userId: readRequiredString(record, 'userId', schemaName),
      x: readRequiredFiniteNumber(record, 'x', schemaName),
      y: readRequiredFiniteNumber(record, 'y', schemaName),
      vx: readRequiredFiniteNumber(record, 'vx', schemaName),
      vy: readRequiredFiniteNumber(record, 'vy', schemaName),
      state: readRequiredString(record, 'state', schemaName),
      progress: readRequiredFiniteNumber(record, 'progress', schemaName, 0, 100),
      clientTime: readRequiredFiniteNumber(record, 'clientTime', schemaName),
    }
  },
)

export const raceFinishedPayloadSchema = defineSchema<RaceFinishedPayload>(
  'raceFinishedPayloadSchema',
  (value, schemaName) => {
    const record = asRecord(value, schemaName)

    return {
      roomId: readRequiredString(record, 'roomId', schemaName),
      userId: readRequiredString(record, 'userId', schemaName),
      finishTimeMs: readRequiredFiniteNumber(record, 'finishTimeMs', schemaName, 0),
    }
  },
)

export const resultsFinalPayloadSchema = raceResultSchema

function defineSchema<T>(
  schemaName: string,
  parser: (value: unknown, schemaName: string) => T,
): ContractSchema<T> {
  return {
    parse(value: unknown) {
      return parser(value, schemaName)
    },
    safeParse(value: unknown) {
      try {
        return { success: true, data: parser(value, schemaName) }
      } catch (error) {
        if (error instanceof SchemaValidationError) {
          return { success: false, error }
        }

        return {
          success: false,
          error: new SchemaValidationError(schemaName, [
            { path: '$', message: error instanceof Error ? error.message : 'unknown error' },
          ]),
        }
      }
    },
  }
}

function enumSchema<const TValues extends readonly string[]>(
  schemaName: string,
  values: TValues,
): ContractSchema<TValues[number]> {
  return defineSchema(schemaName, (value) => parseEnumValue(value, values, schemaName, '$'))
}

function parseAssetSprite(value: unknown, schemaName: string, path: string): AssetSprite {
  const record = asRecord(value, schemaName, path)

  return {
    action: parseEnumValue(record.action, assetSpriteActionValues, schemaName, `${path}.action`),
    status: assetStatusSchema.parse(record.status),
    sheetUrl: readNullableString(record, 'sheetUrl', schemaName, false, `${path}.sheetUrl`),
    frameCount: readNullableInteger(record, 'frameCount', schemaName, 1, undefined, `${path}.frameCount`),
    lastRegenAt: readNullableString(record, 'lastRegenAt', schemaName, false, `${path}.lastRegenAt`),
  }
}

function parseRealtimeRoomPlayer(
  value: unknown,
  schemaName: string,
  path: string,
): RealtimeRoomPlayer {
  const record = asRecord(value, schemaName, path)
  const rank =
    record.rank === undefined
      ? undefined
      : readRequiredInteger(record, 'rank', schemaName, 1, undefined, `${path}.rank`)

  return {
    userId: readRequiredString(record, 'userId', schemaName, `${path}.userId`),
    nickname: readRequiredString(record, 'nickname', schemaName, `${path}.nickname`),
    isHost: readRequiredBoolean(record, 'isHost', schemaName, `${path}.isHost`),
    isReady: readRequiredBoolean(record, 'isReady', schemaName, `${path}.isReady`),
    validationCleared: readRequiredBoolean(record, 'validationCleared', schemaName, `${path}.validationCleared`),
    raceProgress: readRequiredFiniteNumber(record, 'raceProgress', schemaName, 0, 100, `${path}.raceProgress`),
    raceFinishedAtMs: readNullableFiniteNumber(record, 'raceFinishedAtMs', schemaName, 0, undefined, `${path}.raceFinishedAtMs`),
    raceDistanceToGoal: readRequiredFiniteNumber(record, 'raceDistanceToGoal', schemaName, 0, undefined, `${path}.raceDistanceToGoal`),
    rank,
  }
}

function parseRaceResultPlayer(
  value: unknown,
  schemaName: string,
  path: string,
): RaceResultPlayer {
  const player = parseRealtimeRoomPlayer(value, schemaName, path)

  if (player.rank === undefined) {
    throw schemaError(schemaName, `${path}.rank`, 'rank is required')
  }

  return {
    userId: player.userId,
    nickname: player.nickname,
    isHost: player.isHost,
    isReady: player.isReady,
    validationCleared: player.validationCleared,
    raceProgress: player.raceProgress,
    raceFinishedAtMs: player.raceFinishedAtMs,
    raceDistanceToGoal: player.raceDistanceToGoal,
    rank: player.rank,
  }
}

function asRecord(
  value: unknown,
  schemaName: string,
  path = '$',
): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  throw schemaError(schemaName, path, 'expected object')
}

function parseEnumValue<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues,
  schemaName: string,
  path: string,
): TValues[number] {
  if (typeof value === 'string' && values.includes(value)) {
    return value
  }

  throw schemaError(schemaName, path, `expected one of ${values.join(', ')}`)
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
  path = key,
): string {
  const value = record[key]

  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  throw schemaError(schemaName, path, 'expected non-empty string')
}

function readRequiredText(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
): string {
  const value = record[key]

  if (typeof value === 'string') {
    return value
  }

  throw schemaError(schemaName, key, 'expected string')
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
): string | undefined {
  if (record[key] === undefined) {
    return undefined
  }

  return readRequiredString(record, key, schemaName)
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
  allowMissing = false,
  path = key,
): string | null {
  const value = record[key]

  if (value === null || (allowMissing && value === undefined)) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  throw schemaError(schemaName, path, 'expected string or null')
}

function readOptionalNullableString(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
): string | null | undefined {
  if (record[key] === undefined) {
    return undefined
  }

  return readNullableString(record, key, schemaName)
}

function readRequiredBoolean(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
  path = key,
): boolean {
  const value = record[key]

  if (typeof value === 'boolean') {
    return value
  }

  throw schemaError(schemaName, path, 'expected boolean')
}

function readRequiredInteger(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
  min?: number,
  max?: number,
  path = key,
): number {
  const value = record[key]

  if (Number.isInteger(value) && isWithinRange(value as number, min, max)) {
    return value as number
  }

  throw schemaError(schemaName, path, 'expected integer in range')
}

function readNullableInteger(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
  min?: number,
  max?: number,
  path = key,
): number | null {
  const value = record[key]

  if (value === null) {
    return null
  }

  return readRequiredInteger(record, key, schemaName, min, max, path)
}

function readRequiredFiniteNumber(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
  min?: number,
  max?: number,
  path = key,
): number {
  const value = record[key]

  if (typeof value === 'number' && Number.isFinite(value) && isWithinRange(value, min, max)) {
    return value
  }

  throw schemaError(schemaName, path, 'expected finite number in range')
}

function readNullableFiniteNumber(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
  min?: number,
  max?: number,
  path = key,
): number | null {
  const value = record[key]

  if (value === null) {
    return null
  }

  return readRequiredFiniteNumber(record, key, schemaName, min, max, path)
}

function readExactNull(
  record: Record<string, unknown>,
  key: string,
  schemaName: string,
): null {
  if (record[key] === null) {
    return null
  }

  throw schemaError(schemaName, key, 'expected null')
}

function readArray(value: unknown, schemaName: string, path: string): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  throw schemaError(schemaName, path, 'expected array')
}

function readAttrs(value: unknown, schemaName: string, path: string): AssetAttrs {
  const record = asRecord(value, schemaName, path)
  const attrs: AssetAttrs = {}

  for (const [key, item] of Object.entries(record)) {
    if (
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean' ||
      item === null
    ) {
      attrs[key] = item
      continue
    }

    throw schemaError(schemaName, `${path}.${key}`, 'expected string, number, boolean, or null')
  }

  return attrs
}

function readStringRecord(value: unknown, schemaName: string, path: string): Record<string, string> {
  const record = asRecord(value, schemaName, path)
  const result: Record<string, string> = {}

  for (const [key, item] of Object.entries(record)) {
    if (typeof item !== 'string') {
      throw schemaError(schemaName, `${path}.${key}`, 'expected string')
    }

    result[key] = item
  }

  return result
}

function readFieldErrors(
  value: unknown,
  schemaName: string,
  path: string,
): Record<string, string[]> {
  const record = asRecord(value, schemaName, path)
  const result: Record<string, string[]> = {}

  for (const [key, item] of Object.entries(record)) {
    if (!Array.isArray(item) || !item.every((message) => typeof message === 'string')) {
      throw schemaError(schemaName, `${path}.${key}`, 'expected string[]')
    }

    result[key] = item
  }

  return result
}

function isWithinRange(value: number, min?: number, max?: number) {
  return (min === undefined || value >= min) && (max === undefined || value <= max)
}

function schemaError(schemaName: string, path: string, message: string): SchemaValidationError {
  return new SchemaValidationError(schemaName, [{ path, message }])
}
