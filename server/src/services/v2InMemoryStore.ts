export type AssetCategory = 'avatar' | 'platform' | 'obstacle' | 'monster' | 'background' | 'item'
export type AssetStatus = 'queued' | 'generating' | 'ready' | 'failed'
export type RoomPhase = 'lobby' | 'building' | 'validating' | 'merging' | 'racing' | 'finished'
export type AssetSpriteAction = 'idle' | 'walk' | 'onair' | 'static'

export const RACE_MS_PER_LINE = 40_000
export const FIRST_FINISH_COUNTDOWN_MS = 10_000
export const LAST_DANCE_MS = 30_000
export const BUILD_LATE_JOIN_CUTOFF_MS = 60_000

const phaseDurationMs: Partial<Record<RoomPhase, number>> = {
  building: 180_000,
  validating: 120_000,
}

export interface V2Session {
  id: string
  nickname: string
  token: string
  avatarAssetId?: string
}

export interface V2Asset {
  id: string
  user_id: string | null
  userId: string | null
  creator_id: string | null
  creatorId: string | null
  isSystem: boolean
  is_system: boolean
  category: AssetCategory
  name: string
  description: string
  attrs: Record<string, string | number | boolean | null>
  colliderType: 'rect' | 'slope' | 'none'
  collider_type: 'rect' | 'slope' | 'none'
  widthCells: number | null
  width_cells: number | null
  heightCells: number | null
  height_cells: number | null
  sourceImageUrl: string
  source_image_url: string
  remixOfId: string | null
  remix_of_id: string | null
  status: AssetStatus
  isPublic: boolean
  is_public: boolean
  createdAt: string
  created_at: string
  sprites: Array<{
    action: AssetSpriteAction
    status: AssetStatus
    sheetUrl: string | null
    sheet_url: string | null
    frameCount: number | null
    frame_count: number | null
    lastRegenAt: string | null
    last_regen_at: string | null
  }>
}

export interface V2Room {
  id: string
  name: string
  hostId: string | null
  host_id: string | null
  hostNickname: string
  host_nickname: string
  isPublic: boolean
  is_public: boolean
  players: number
  maxPlayers: 2 | 3 | 4
  max_players: 2 | 3 | 4
  phase: RoomPhase
  elapsedSeconds: number
  elapsed_seconds: number
  password?: string
  memberIds: string[]
  readyUserIds: string[]
  createdAtMs: number
  phaseDurationMs?: number | null
  hasOvertime?: boolean
}

export interface V2RoomPlayerSnapshot {
  userId: string
  user_id: string
  nickname: string
  isHost: boolean
  is_host: boolean
  isReady: boolean
  is_ready: boolean
}

export interface V2MapSegment {
  id: string
  roomId: string
  room_id: string
  creatorId: string
  creator_id: string
  startPoint: { x: number; y: number }
  start_point: { x: number; y: number }
  endPoint: { x: number; y: number }
  end_point: { x: number; y: number }
  placements: Array<{
    id: string
    x: number
    y: number
    asset: V2Asset
  }>
  assets: Array<{
    assetId: string
    asset_id: string
    assetCategory: AssetCategory
    asset_category: AssetCategory
    assetAttrs: Record<string, string | number | boolean | null>
    asset_attrs: Record<string, string | number | boolean | null>
    colliderType: 'rect' | 'slope' | 'none'
    collider_type: 'rect' | 'slope' | 'none'
    x: number
    y: number
    widthCells: number
    width_cells: number
    heightCells: number
    height_cells: number
    rotation: number
  }>
  segmentHash: string
  segment_hash: string
  isValidated: boolean
  is_validated: boolean
  submittedAt: string
  submitted_at: string
  validatedAt: string | null
  validated_at: string | null
  clearTimeMs: number | null
  clear_time_ms: number | null
}

export interface V2MergedMap {
  id: string
  roomId: string
  room_id: string
  globalStart: { x: number; y: number }
  global_start: { x: number; y: number }
  globalEnd: { x: number; y: number }
  global_end: { x: number; y: number }
  placements: Array<V2MapSegment['assets'][number] & {
    sourceSegmentId: string
    source_segment_id: string
  }>
  segments: V2MapSegment[]
  usedFallback: boolean
  used_fallback: boolean
  createdAt: string
  created_at: string
}

export interface V2RaceResultPlayer {
  userId: string
  user_id: string
  nickname: string
  isHost: boolean
  is_host: boolean
  isReady: boolean
  is_ready: boolean
  validationCleared: boolean
  validation_cleared: boolean
  raceProgress: number
  race_progress: number
  raceFinishedAtMs: number | null
  race_finished_at_ms: number | null
  raceDistanceToGoal: number
  race_distance_to_goal: number
  rank: number
}

export interface V2RaceResult {
  roomId: string
  room_id: string
  players: V2RaceResultPlayer[]
  updatedAt: string
  updated_at: string
}

export interface V2DeviceCode {
  code: string
  userId: string
  expiresAt: string
  consumed: boolean
}

export interface V2AssetJob {
  id: string
  userId: string
  status: AssetStatus
  targetType: string
  outputAssetId: string | null
  action: AssetSpriteAction | null
  errorCode: string | null
  errorMessage: string | null
  leasedBy: string | null
  leaseExpiresAtMs: number | null
  createdAtMs: number
  updatedAtMs: number
}

export interface V2StoreState {
  sessions: Map<string, V2Session>
  assets: Map<string, V2Asset>
  assetJobs: Map<string, V2AssetJob>
  rooms: Map<string, V2Room>
  segments: Map<string, V2MapSegment>
  mergedMaps: Map<string, V2MergedMap>
  raceResults: Map<string, V2RaceResult>
  deviceCodes: Map<string, V2DeviceCode>
}

export function createV2InMemoryStore(): V2StoreState {
  const store: V2StoreState = {
    sessions: new Map(),
    assets: new Map(),
    assetJobs: new Map(),
    rooms: new Map(),
    segments: new Map(),
    mergedMaps: new Map(),
    raceResults: new Map(),
    deviceCodes: new Map(),
  }

  seedSystemAssets(store)
  seedRooms(store)

  return store
}

export function createSession(store: V2StoreState, nickname: string): V2Session {
  const normalizedNickname = nickname.trim()
  const id = `user-${slugify(normalizedNickname)}-${randomToken(4)}`
  const session: V2Session = {
    id,
    nickname: normalizedNickname,
    token: `v2-token-${Date.now().toString(36)}-${randomToken(18)}`,
  }

  store.sessions.set(session.token, session)

  return session
}

export function getSessionByToken(store: V2StoreState, token: string | undefined) {
  return token ? store.sessions.get(token) ?? null : null
}

export function getSessionByUserId(store: V2StoreState, userId: string | undefined) {
  return userId ? [...store.sessions.values()].find((session) => session.id === userId) ?? null : null
}

export function getRoomById(store: V2StoreState, roomId: string | undefined) {
  return roomId ? store.rooms.get(roomId) ?? null : null
}

export function getRoomSnapshot(store: V2StoreState, roomId: string | undefined) {
  const room = getRoomById(store, roomId)

  if (!room) {
    return null
  }

  return {
    room,
    players: room.memberIds.map((userId) => toRoomPlayerSnapshot(store, room, userId)),
  }
}

export function updateSessionNickname(store: V2StoreState, token: string, nickname: string) {
  const session = getSessionByToken(store, token)

  if (!session) {
    return null
  }

  const updatedSession = { ...session, nickname: nickname.trim() }

  store.sessions.set(token, updatedSession)

  return updatedSession
}

export function listAssetsForUser(store: V2StoreState, userId: string) {
  return [...store.assets.values()].filter((asset) => asset.isSystem || asset.user_id === userId)
}

export function createGeneratedAsset(
  store: V2StoreState,
  payload: {
    userId: string
    category: AssetCategory
    name: string
    description: string
    attrs?: Record<string, string | number | boolean | null>
    widthCells?: number | null
    heightCells?: number | null
    remixOfId?: string | null
    image?: string
    status?: AssetStatus
  },
) {
  const now = new Date().toISOString()
  const asset = normalizeAsset({
    id: `asset-${payload.category}-${randomToken(8)}`,
    userId: payload.userId,
    category: payload.category,
    name: payload.name,
    description: payload.description,
    attrs: payload.attrs ?? {},
    widthCells: payload.category === 'avatar' ? null : payload.widthCells ?? 1,
    heightCells: payload.category === 'avatar' ? null : payload.heightCells ?? 1,
    colliderType: payload.category === 'background' ? 'none' : 'rect',
    sourceImageUrl: payload.image ?? '',
    remixOfId: payload.remixOfId ?? null,
    status: payload.status ?? 'ready',
    createdAt: now,
    isSystem: false,
  })

  store.assets.set(asset.id, asset)
  const job = createAssetJob(store, {
    userId: payload.userId,
    outputAssetId: asset.id,
    targetType: payload.category === 'avatar' ? 'avatar' : 'component',
    action: null,
    status: asset.status,
  })

  const session = [...store.sessions.values()].find((candidate) => candidate.id === payload.userId)

  if (session && payload.category === 'avatar' && !session.avatarAssetId) {
    const updatedSession = { ...session, avatarAssetId: asset.id }

    store.sessions.set(updatedSession.token, updatedSession)
  }

  return { asset, job }
}

export function equipAvatarAsset(store: V2StoreState, session: V2Session, assetId: string) {
  const asset = store.assets.get(assetId)

  if (!asset || asset.category !== 'avatar') {
    return { ok: false as const, status: 404, message: '장착할 아바타를 찾을 수 없어요.' }
  }

  if (asset.status !== 'ready') {
    return { ok: false as const, status: 409, message: '아직 사용할 수 없는 아바타예요.' }
  }

  if (!asset.isSystem && asset.user_id !== session.id) {
    return { ok: false as const, status: 403, message: '다른 사용자의 아바타는 장착할 수 없어요.' }
  }

  const updatedSession = { ...session, avatarAssetId: asset.id }

  store.sessions.set(updatedSession.token, updatedSession)

  return { ok: true as const, session: updatedSession }
}

export function retryAssetGeneration(store: V2StoreState, session: V2Session, assetId: string) {
  const asset = store.assets.get(assetId)

  if (!asset) {
    return { ok: false as const, status: 404, message: '다시 시도할 에셋을 찾을 수 없어요.' }
  }

  if (asset.isSystem || asset.user_id !== session.id) {
    return { ok: false as const, status: 403, message: '다른 사용자의 에셋은 다시 시도할 수 없어요.' }
  }

  if (asset.status !== 'failed') {
    return { ok: false as const, status: 409, message: '실패한 에셋만 다시 시도할 수 있어요.' }
  }

  const updatedAsset = updateAssetGenerationState(asset, 'generating')

  store.assets.set(asset.id, updatedAsset)
  createAssetJob(store, {
    userId: session.id,
    outputAssetId: asset.id,
    targetType: `${asset.category}:retry`,
    action: null,
    status: 'generating',
  })

  return { ok: true as const, asset: updatedAsset }
}

export function regenerateAssetAction(
  store: V2StoreState,
  session: V2Session,
  assetId: string,
  action: AssetSpriteAction,
  nowMs = Date.now(),
) {
  const asset = store.assets.get(assetId)

  if (!asset) {
    return { ok: false as const, status: 404, message: '재생성할 에셋을 찾을 수 없어요.' }
  }

  if (asset.isSystem || asset.user_id !== session.id) {
    return { ok: false as const, status: 403, message: '다른 사용자의 에셋은 재생성할 수 없어요.' }
  }

  if (asset.status !== 'ready') {
    return { ok: false as const, status: 409, message: '사용 가능한 에셋만 재생성할 수 있어요.' }
  }

  const sprite = asset.sprites.find((candidate) => candidate.action === action)

  if (!sprite) {
    return { ok: false as const, status: 400, message: '재생성할 액션을 확인해주세요.' }
  }

  const lastRegenMs = sprite.lastRegenAt ? Date.parse(sprite.lastRegenAt) : Number.NaN

  if (!Number.isNaN(lastRegenMs) && lastRegenMs + 5 * 60 * 1000 > nowMs) {
    return { ok: false as const, status: 429, message: '액션 재생성은 5분마다 요청할 수 있어요.' }
  }

  const now = new Date(nowMs).toISOString()
  const updatedAsset = {
    ...asset,
    sprites: asset.sprites.map((candidate) =>
      candidate.action === action
        ? {
            ...candidate,
            status: 'generating' as AssetStatus,
            lastRegenAt: now,
            last_regen_at: now,
          }
        : candidate,
    ),
  }

  store.assets.set(asset.id, updatedAsset)
  createAssetJob(store, {
    userId: session.id,
    outputAssetId: asset.id,
    targetType: `${asset.category}:sprite`,
    action,
    status: 'generating',
  })

  return { ok: true as const, asset: updatedAsset }
}

export function listAssetJobsForUser(store: V2StoreState, userId: string, nowMs = Date.now()) {
  expireAssetJobLeases(store, nowMs)

  return [...store.assetJobs.values()]
    .filter((job) => job.userId === userId)
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
}

export function claimNextAssetJob(
  store: V2StoreState,
  workerId: string,
  nowMs = Date.now(),
) {
  expireAssetJobLeases(store, nowMs)

  const job = [...store.assetJobs.values()]
    .filter((candidate) =>
      (candidate.status === 'queued' || candidate.status === 'generating') &&
      (candidate.leasedBy === null || (candidate.leaseExpiresAtMs ?? 0) <= nowMs),
    )
    .sort((left, right) => left.createdAtMs - right.createdAtMs)[0]

  if (!job) {
    return null
  }

  const updatedJob: V2AssetJob = {
    ...job,
    status: 'generating',
    leasedBy: workerId,
    leaseExpiresAtMs: nowMs + 2 * 60 * 1000,
    updatedAtMs: nowMs,
  }
  const asset = job.outputAssetId ? store.assets.get(job.outputAssetId) : null

  if (asset) {
    store.assets.set(
      asset.id,
      job.action
        ? updateAssetSpriteState(asset, job.action, 'generating', nowMs)
        : updateAssetGenerationState(asset, 'generating'),
    )
  }

  store.assetJobs.set(job.id, updatedJob)

  return { job: updatedJob, asset: asset ?? null }
}

export function completeAssetJob(
  store: V2StoreState,
  jobId: string,
  payload: {
    status: Extract<AssetStatus, 'ready' | 'failed'>
    sheetUrl?: string | null
    sourceImageUrl?: string | null
    errorCode?: string | null
    errorMessage?: string | null
  },
  nowMs = Date.now(),
) {
  const job = store.assetJobs.get(jobId)

  if (!job) {
    return { ok: false as const, status: 404, message: '처리할 에셋 작업을 찾을 수 없어요.' }
  }

  const asset = job.outputAssetId ? store.assets.get(job.outputAssetId) : null

  if (!asset) {
    const failedJob: V2AssetJob = {
      ...job,
      status: 'failed' as AssetStatus,
      leasedBy: null,
      leaseExpiresAtMs: null,
      errorCode: 'ASSET_NOT_FOUND',
      errorMessage: '완료할 에셋을 찾을 수 없어요.',
      updatedAtMs: nowMs,
    }

    store.assetJobs.set(job.id, failedJob)

    return { ok: false as const, status: 404, message: failedJob.errorMessage }
  }

  const updatedAsset = payload.status === 'ready'
    ? job.action
      ? updateAssetSpriteState(asset, job.action, 'ready', nowMs, payload.sheetUrl)
      : updateAssetGenerationState(
          {
            ...asset,
            sourceImageUrl: payload.sourceImageUrl ?? payload.sheetUrl ?? asset.sourceImageUrl,
            source_image_url: payload.sourceImageUrl ?? payload.sheetUrl ?? asset.source_image_url,
          },
          'ready',
          payload.sheetUrl ?? payload.sourceImageUrl ?? null,
        )
    : job.action
      ? updateAssetSpriteState(asset, job.action, 'failed', nowMs)
      : updateAssetGenerationState(asset, 'failed')
  const updatedJob: V2AssetJob = {
    ...job,
    status: payload.status,
    leasedBy: null,
    leaseExpiresAtMs: null,
    errorCode: payload.errorCode ?? null,
    errorMessage: payload.errorMessage ?? null,
    updatedAtMs: nowMs,
  }

  store.assets.set(asset.id, updatedAsset)
  store.assetJobs.set(job.id, updatedJob)

  return { ok: true as const, job: updatedJob, asset: updatedAsset }
}

export function createRoom(
  store: V2StoreState,
  payload: {
    userId: string
    name: string
    isPublic: boolean
    password?: string
    maxPlayers: 2 | 3 | 4
  },
) {
  const hostSession = [...store.sessions.values()].find((session) => session.id === payload.userId)
  const nowMs = Date.now()
  const room: V2Room = {
    id: `room-${randomToken(8)}`,
    name: payload.name.trim(),
    hostId: payload.userId,
    host_id: payload.userId,
    hostNickname: hostSession?.nickname ?? '방장',
    host_nickname: hostSession?.nickname ?? '방장',
    isPublic: payload.isPublic,
    is_public: payload.isPublic,
    players: 1,
    maxPlayers: payload.maxPlayers,
    max_players: payload.maxPlayers,
    phase: 'lobby',
    elapsedSeconds: 0,
    elapsed_seconds: 0,
    password: payload.isPublic ? undefined : payload.password,
    memberIds: [payload.userId],
    readyUserIds: [payload.userId],
    createdAtMs: nowMs,
    phaseDurationMs: null,
    hasOvertime: false,
  }

  store.rooms.set(room.id, room)

  return room
}

export function joinRoom(
  store: V2StoreState,
  roomId: string,
  userId: string,
  password?: string,
) {
  const room = store.rooms.get(roomId)

  if (!room) {
    return { ok: false as const, status: 404, message: '입장할 수 있는 방을 찾을 수 없어요.' }
  }

  if (!canJoinRoomPhase(room)) {
    return room.phase === 'building'
      ? {
          ok: false as const,
          status: 409,
          message: '제작 시간이 1분 미만이라 새 제작자로 입장할 수 없어요.',
        }
      : { ok: false as const, status: 404, message: '입장할 수 있는 방을 찾을 수 없어요.' }
  }

  if (!room.isPublic && (password ?? '') !== (room.password ?? '')) {
    return { ok: false as const, status: 403, message: '비밀번호를 확인해주세요.' }
  }

  if (!room.memberIds.includes(userId) && room.memberIds.length >= room.maxPlayers) {
    return { ok: false as const, status: 409, message: '정원이 찼어요.' }
  }

  const memberIds = room.memberIds.includes(userId) ? room.memberIds : [...room.memberIds, userId]
  const updatedRoom = {
    ...room,
    memberIds,
    players: memberIds.length,
    readyUserIds: normalizeReadyUserIds(room, memberIds),
  }

  store.rooms.set(room.id, updatedRoom)

  return { ok: true as const, room: updatedRoom }
}

export function joinPublicRoom(store: V2StoreState, userId: string) {
  const room = [...store.rooms.values()].find(
    (candidate) =>
      candidate.isPublic &&
      canJoinRoomPhase(candidate) &&
      candidate.memberIds.length < candidate.maxPlayers,
  )

  if (!room) {
    return { ok: false as const, status: 404, message: '입장 가능한 공개방이 없습니다.' }
  }

  return joinRoom(store, room.id, userId)
}

export function leaveRoom(
  store: V2StoreState,
  roomId: string,
  userId: string,
) {
  const room = store.rooms.get(roomId)

  if (!room || !room.memberIds.includes(userId)) {
    return { ok: false as const, status: 404, message: '나갈 방을 찾을 수 없어요.' }
  }

  const memberIds = room.memberIds.filter((memberId) => memberId !== userId)

  if (memberIds.length === 0) {
    store.rooms.delete(room.id)
    return { ok: true as const, room: null }
  }

  const hostId = memberIds.includes(room.hostId ?? '') ? room.hostId : memberIds[0]
  const hostSession = getSessionByUserId(store, hostId)
  const updatedRoom: V2Room = {
    ...room,
    hostId,
    host_id: hostId,
    hostNickname: hostSession?.nickname ?? (hostId === room.hostId ? room.hostNickname : '방장'),
    host_nickname: hostSession?.nickname ?? (hostId === room.hostId ? room.hostNickname : '방장'),
    memberIds,
    readyUserIds: normalizeReadyUserIds(
      {
        hostId,
        readyUserIds: room.readyUserIds,
      },
      memberIds,
    ),
    players: memberIds.length,
  }

  store.rooms.set(room.id, updatedRoom)

  return { ok: true as const, room: updatedRoom }
}

export function setRoomReady(
  store: V2StoreState,
  roomId: string,
  userId: string,
  isReady: boolean,
) {
  const room = store.rooms.get(roomId)

  if (!room || room.phase !== 'lobby' || !room.memberIds.includes(userId)) {
    return { ok: false as const, status: 404, message: '준비 상태를 바꿀 방을 찾을 수 없어요.' }
  }

  if (room.hostId === userId) {
    return { ok: false as const, status: 409, message: '방장은 항상 준비 상태예요.' }
  }

  const readyUserIds = isReady
    ? [...new Set([...room.readyUserIds, userId])]
    : room.readyUserIds.filter((readyUserId) => readyUserId !== userId)
  const updatedRoom: V2Room = {
    ...room,
    readyUserIds: normalizeReadyUserIds(
      {
        ...room,
        readyUserIds,
      },
      room.memberIds,
    ),
  }

  store.rooms.set(room.id, updatedRoom)

  return { ok: true as const, room: updatedRoom }
}

export function startRoom(
  store: V2StoreState,
  roomId: string,
  userId: string,
) {
  const room = store.rooms.get(roomId)

  if (!room) {
    return { ok: false as const, status: 404, message: '시작할 방을 찾을 수 없어요.' }
  }

  if (room.hostId !== userId) {
    return { ok: false as const, status: 403, message: '방장만 게임을 시작할 수 있어요.' }
  }

  if (room.phase !== 'lobby') {
    return { ok: false as const, status: 409, message: '이미 게임이 진행 중이에요.' }
  }

  if (room.memberIds.length < 2) {
    return { ok: false as const, status: 409, message: '최소 2명이 필요해요.' }
  }

  if (!areGuestsReady(room)) {
    return { ok: false as const, status: 409, message: '아직 준비하지 않은 플레이어가 있어요.' }
  }

  const updatedRoom: V2Room = {
    ...room,
    phase: 'building',
    elapsedSeconds: 0,
    elapsed_seconds: 0,
    createdAtMs: Date.now(),
    phaseDurationMs: phaseDurationMs.building,
    hasOvertime: false,
  }

  store.rooms.set(room.id, updatedRoom)

  return { ok: true as const, room: updatedRoom }
}

export function saveMapSegment(
  store: V2StoreState,
  payload: {
    roomId: string
    userId: string
    startPoint: { x: number; y: number }
    endPoint: { x: number; y: number }
    assets: Array<{
      assetId: string
      x: number
      y: number
      widthCells?: number
      heightCells?: number
      rotation?: number
    }>
  },
) {
  const room = store.rooms.get(payload.roomId)

  if (!room || room.phase !== 'building' || !room.memberIds.includes(payload.userId)) {
    return null
  }

  const now = new Date().toISOString()
  const assets = payload.assets.map((assetRef) => {
    const asset = store.assets.get(assetRef.assetId) ?? [...store.assets.values()][0]

    return {
      assetId: asset.id,
      asset_id: asset.id,
      assetCategory: asset.category,
      asset_category: asset.category,
      assetAttrs: asset.attrs,
      asset_attrs: asset.attrs,
      colliderType: asset.colliderType,
      collider_type: asset.colliderType,
      x: Number.isFinite(assetRef.x) ? assetRef.x : 0,
      y: Number.isFinite(assetRef.y) ? assetRef.y : 0,
      widthCells: Math.max(1, assetRef.widthCells ?? asset.widthCells ?? 1),
      width_cells: Math.max(1, assetRef.widthCells ?? asset.widthCells ?? 1),
      heightCells: Math.max(1, assetRef.heightCells ?? asset.heightCells ?? 1),
      height_cells: Math.max(1, assetRef.heightCells ?? asset.heightCells ?? 1),
      rotation: assetRef.rotation ?? 0,
    }
  })
  const id = `segment-${payload.roomId}-${payload.userId}-${randomToken(6)}`
  const segmentHash = `hash-${hashString(JSON.stringify({ ...payload, id }))}`
  const segment: V2MapSegment = {
    id,
    roomId: payload.roomId,
    room_id: payload.roomId,
    creatorId: payload.userId,
    creator_id: payload.userId,
    startPoint: payload.startPoint,
    start_point: payload.startPoint,
    endPoint: payload.endPoint,
    end_point: payload.endPoint,
    placements: assets.map((assetRef, index) => ({
      id: `placement-${id}-${index}`,
      x: assetRef.x,
      y: assetRef.y,
      asset: store.assets.get(assetRef.assetId) ?? [...store.assets.values()][0],
    })),
    assets,
    segmentHash,
    segment_hash: segmentHash,
    isValidated: false,
    is_validated: false,
    submittedAt: now,
    submitted_at: now,
    validatedAt: null,
    validated_at: null,
    clearTimeMs: null,
    clear_time_ms: null,
  }

  store.segments.set(segment.id, segment)

  if (areLatestRoomSegmentsSubmitted(store, payload.roomId)) {
    updateRoomPhase(store, payload.roomId, 'validating')
  }

  return segment
}

export function getMapSegment(
  store: V2StoreState,
  roomId: string,
  segmentId: string,
) {
  const segment = store.segments.get(segmentId)

  return segment?.roomId === roomId ? segment : null
}

export function validateMapSegment(
  store: V2StoreState,
  payload: {
    roomId: string
    userId: string
    segmentHash: string
    cleared: boolean
    clearTimeMs: number
  },
) {
  const room = store.rooms.get(payload.roomId)

  if (!room || room.phase !== 'validating' || !room.memberIds.includes(payload.userId)) {
    return null
  }

  const segment = [...store.segments.values()].find(
    (candidate) =>
      candidate.roomId === payload.roomId &&
      candidate.creatorId === payload.userId &&
      candidate.segmentHash === payload.segmentHash,
  )

  if (!segment) {
    return null
  }

  const now = new Date().toISOString()
  const updatedSegment = {
    ...segment,
    isValidated: payload.cleared,
    is_validated: payload.cleared,
    validatedAt: now,
    validated_at: now,
    clearTimeMs: payload.cleared ? payload.clearTimeMs : null,
    clear_time_ms: payload.cleared ? payload.clearTimeMs : null,
  }

  store.segments.set(segment.id, updatedSegment)

  if (areLatestRoomSegmentsRecorded(store, payload.roomId)) {
    updateRoomPhase(store, payload.roomId, 'merging')
  }

  return updatedSegment
}

export function mergeRoomMap(store: V2StoreState, roomId: string) {
  const room = store.rooms.get(roomId)

  if (!room || room.phase !== 'merging') {
    return null
  }

  const roomSegments = [...store.segments.values()].filter((segment) => segment.roomId === roomId)
  const validSegments = roomSegments.filter((segment) => segment.isValidated)
  const sourceSegments = validSegments.length > 0 ? validSegments : roomSegments

  if (sourceSegments.length === 0) {
    return null
  }

  const now = new Date().toISOString()
  const mergedMap: V2MergedMap = {
    id: `merged-${roomId}-${randomToken(6)}`,
    roomId,
    room_id: roomId,
    globalStart: sourceSegments[0].startPoint,
    global_start: sourceSegments[0].startPoint,
    globalEnd: {
      x: Math.max(...sourceSegments.map((segment) => segment.endPoint.x)),
      y: sourceSegments[sourceSegments.length - 1].endPoint.y,
    },
    global_end: {
      x: Math.max(...sourceSegments.map((segment) => segment.endPoint.x)),
      y: sourceSegments[sourceSegments.length - 1].endPoint.y,
    },
    placements: sourceSegments.flatMap((segment, segmentIndex) =>
      segment.assets.map((asset) => ({
        ...asset,
        x: asset.x + segmentIndex * 24,
        sourceSegmentId: segment.id,
        source_segment_id: segment.id,
      })),
    ),
    segments: sourceSegments,
    usedFallback: validSegments.length === 0,
    used_fallback: validSegments.length === 0,
    createdAt: now,
    created_at: now,
  }

  store.mergedMaps.set(mergedMap.id, mergedMap)
  updateRoomPhase(store, roomId, 'racing', Date.now(), getRaceDurationMs(sourceSegments.length))

  return mergedMap
}

export function getMergedMap(
  store: V2StoreState,
  roomId: string,
  mergedMapId?: string | null,
) {
  if (mergedMapId) {
    const mergedMap = store.mergedMaps.get(mergedMapId)

    return mergedMap?.roomId === roomId ? mergedMap : null
  }

  return [...store.mergedMaps.values()]
    .filter((mergedMap) => mergedMap.roomId === roomId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null
}

export function recordRaceProgress(
  store: V2StoreState,
  payload: {
    roomId: string
    userId: string
    progress: number
    raceDistanceToGoal: number
  },
) {
  const room = store.rooms.get(payload.roomId)

  if (!room || room.phase !== 'racing' || !room.memberIds.includes(payload.userId)) {
    return null
  }

  const progress = clampNumber(payload.progress, 0, 100)
  const raceDistanceToGoal = clampNumber(payload.raceDistanceToGoal, 0, 100)
  const previousResult = store.raceResults.get(payload.roomId)
  const previousPlayers = new Map(
    previousResult?.players.map((player) => [player.userId, player]) ?? [],
  )
  const players = room.memberIds.map((userId) => {
    const previousPlayer = previousPlayers.get(userId)
    const session = getSessionByUserId(store, userId)
    const segment = [...store.segments.values()].find(
      (candidate) => candidate.roomId === payload.roomId && candidate.creatorId === userId,
    )
    const isReporter = userId === payload.userId
    const raceFinishedAtMs = previousPlayer?.raceFinishedAtMs ?? null
    const raceProgress = raceFinishedAtMs !== null
      ? 100
      : isReporter
        ? Math.max(previousPlayer?.raceProgress ?? 0, progress)
        : previousPlayer?.raceProgress ?? 0
    const nextRaceDistanceToGoal = raceFinishedAtMs !== null
      ? 0
      : isReporter
        ? raceDistanceToGoal
        : previousPlayer?.raceDistanceToGoal ?? 100

    return {
      userId,
      user_id: userId,
      nickname: session?.nickname ?? previousPlayer?.nickname ?? (room.hostId === userId ? room.hostNickname : '플레이어'),
      isHost: room.hostId === userId,
      is_host: room.hostId === userId,
      isReady: true,
      is_ready: true,
      validationCleared: segment?.isValidated ?? previousPlayer?.validationCleared ?? false,
      validation_cleared: segment?.isValidated ?? previousPlayer?.validationCleared ?? false,
      raceProgress,
      race_progress: raceProgress,
      raceFinishedAtMs,
      race_finished_at_ms: raceFinishedAtMs,
      raceDistanceToGoal: nextRaceDistanceToGoal,
      race_distance_to_goal: nextRaceDistanceToGoal,
      rank: 0,
    }
  })
  const now = new Date().toISOString()
  const result: V2RaceResult = {
    roomId: payload.roomId,
    room_id: payload.roomId,
    players: rankRacePlayers(players),
    updatedAt: now,
    updated_at: now,
  }

  store.raceResults.set(payload.roomId, result)

  return result
}

export function recordRaceFinish(
  store: V2StoreState,
  payload: {
    roomId: string
    userId: string
    finishTimeMs: number
  },
) {
  const room = store.rooms.get(payload.roomId)

  if (!room || room.phase !== 'racing' || !room.memberIds.includes(payload.userId)) {
    return null
  }

  const previousResult = store.raceResults.get(payload.roomId)
  const wasFirstFinisher = !hasAnyRoomMemberFinished(room, previousResult?.players ?? [])
  const previousPlayers = new Map(
    previousResult?.players.map((player) => [player.userId, player]) ?? [],
  )
  const players = room.memberIds.map((userId) => {
    const previousPlayer = previousPlayers.get(userId)
    const session = getSessionByUserId(store, userId)
    const segment = [...store.segments.values()].find(
      (candidate) => candidate.roomId === payload.roomId && candidate.creatorId === userId,
    )
    const isFinisher = userId === payload.userId
    const raceFinishedAtMs = isFinisher
      ? payload.finishTimeMs
      : previousPlayer?.raceFinishedAtMs ?? null
    const raceProgress = raceFinishedAtMs !== null
      ? 100
      : previousPlayer?.raceProgress ?? 0
    const raceDistanceToGoal = raceFinishedAtMs !== null
      ? 0
      : previousPlayer?.raceDistanceToGoal ?? 100

    return {
      userId,
      user_id: userId,
      nickname: session?.nickname ?? previousPlayer?.nickname ?? (room.hostId === userId ? room.hostNickname : '플레이어'),
      isHost: room.hostId === userId,
      is_host: room.hostId === userId,
      isReady: true,
      is_ready: true,
      validationCleared: segment?.isValidated ?? previousPlayer?.validationCleared ?? false,
      validation_cleared: segment?.isValidated ?? previousPlayer?.validationCleared ?? false,
      raceProgress,
      race_progress: raceProgress,
      raceFinishedAtMs,
      race_finished_at_ms: raceFinishedAtMs,
      raceDistanceToGoal,
      race_distance_to_goal: raceDistanceToGoal,
      rank: 0,
    }
  })
  const rankedPlayers = rankRacePlayers(players)
  const now = new Date().toISOString()
  const result: V2RaceResult = {
    roomId: payload.roomId,
    room_id: payload.roomId,
    players: rankedPlayers,
    updatedAt: now,
    updated_at: now,
  }

  store.raceResults.set(payload.roomId, result)

  if (areAllRoomMembersFinished(room, rankedPlayers)) {
    updateRoomPhase(store, payload.roomId, 'finished')
  } else if (wasFirstFinisher && !room.hasOvertime) {
    applyFirstFinishCountdown(store, room, Date.now())
  }

  return result
}

export function getRaceResult(store: V2StoreState, roomId: string) {
  return store.raceResults.get(roomId) ?? null
}

export function issueDeviceCode(store: V2StoreState, userId: string) {
  const code = `${randomToken(5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
  const ticket: V2DeviceCode = {
    code,
    userId,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    consumed: false,
  }

  store.deviceCodes.set(code, ticket)

  return ticket
}

export function consumeDeviceCode(store: V2StoreState, code: string) {
  const ticket = store.deviceCodes.get(code.trim().toUpperCase())

  if (!ticket || ticket.consumed) {
    return { ok: false as const, status: 404, message: '사용할 수 없는 코드예요.' }
  }

  if (Date.parse(ticket.expiresAt) <= Date.now()) {
    return { ok: false as const, status: 410, message: '만료된 코드예요. 새 코드를 발급해주세요.' }
  }

  const session = [...store.sessions.values()].find((candidate) => candidate.id === ticket.userId)

  if (!session) {
    return { ok: false as const, status: 404, message: '세션을 찾을 수 없어요.' }
  }

  store.deviceCodes.set(ticket.code, { ...ticket, consumed: true })

  return { ok: true as const, session }
}

export function advanceExpiredRooms(store: V2StoreState, nowMs = Date.now()) {
  const advancedRooms: V2Room[] = []

  for (const room of [...store.rooms.values()]) {
    const previousPhase = room.phase
    const advancedRoom = advanceExpiredRoomPhase(store, room.id, nowMs)

    if (advancedRoom && advancedRoom.phase !== previousPhase) {
      advancedRooms.push(advancedRoom)
    }
  }

  return advancedRooms
}

export function advanceExpiredRoomPhase(
  store: V2StoreState,
  roomId: string,
  nowMs = Date.now(),
) {
  const room = store.rooms.get(roomId)

  if (!room) {
    return null
  }

  const remainingMs = getRoomPhaseRemainingMs(room, nowMs)

  if (remainingMs === null || remainingMs > 0) {
    return room
  }

  if (room.phase === 'building') {
    return updateRoomPhase(store, room.id, 'validating', nowMs)
  }

  if (room.phase === 'validating') {
    return updateRoomPhase(store, room.id, 'merging', nowMs)
  }

  if (room.phase === 'racing') {
    const previousResult = store.raceResults.get(room.id)

    if (!room.hasOvertime && !hasAnyRoomMemberFinished(room, previousResult?.players ?? [])) {
      return startLastDance(store, room, nowMs)
    }

    finalizeRaceTimeout(store, room, nowMs)

    return updateRoomPhase(store, room.id, 'finished', nowMs)
  }

  return room
}

function updateRoomPhase(
  store: V2StoreState,
  roomId: string,
  phase: RoomPhase,
  nowMs = Date.now(),
  durationOverrideMs?: number,
) {
  const room = store.rooms.get(roomId)

  if (!room) {
    return null
  }

  const durationMs = durationOverrideMs ?? phaseDurationMs[phase] ?? null
  const updatedRoom: V2Room = {
    ...room,
    phase,
    elapsedSeconds: 0,
    elapsed_seconds: 0,
    createdAtMs: nowMs,
    phaseDurationMs: durationMs,
    hasOvertime: phase === 'racing' ? false : room.hasOvertime ?? false,
  }

  store.rooms.set(roomId, updatedRoom)

  return updatedRoom
}

export function getRoomPhaseEndsAt(room: V2Room) {
  const durationMs = room.phaseDurationMs !== undefined
    ? room.phaseDurationMs
    : phaseDurationMs[room.phase] ?? null

  if (durationMs === null) {
    return null
  }

  return new Date(room.createdAtMs + durationMs).toISOString()
}

export function getRoomPhaseRemainingMs(room: V2Room, nowMs = Date.now()) {
  const durationMs = room.phaseDurationMs !== undefined
    ? room.phaseDurationMs
    : phaseDurationMs[room.phase] ?? null

  if (durationMs === null) {
    return null
  }

  return Math.max(room.createdAtMs + durationMs - nowMs, 0)
}

function areLatestRoomSegmentsRecorded(store: V2StoreState, roomId: string) {
  const room = store.rooms.get(roomId)
  const latestSegments = getLatestRoomSegmentsByCreator(store, roomId)

  return (
    !!room &&
    room.memberIds.length > 0 &&
    room.memberIds.every((memberId) => latestSegments.get(memberId)?.validatedAt !== null)
  )
}

function areLatestRoomSegmentsSubmitted(store: V2StoreState, roomId: string) {
  const room = store.rooms.get(roomId)
  const latestSegments = getLatestRoomSegmentsByCreator(store, roomId)

  return (
    !!room &&
    room.memberIds.length > 0 &&
    room.memberIds.every((memberId) => latestSegments.has(memberId))
  )
}

function getLatestRoomSegmentsByCreator(store: V2StoreState, roomId: string) {
  const latestSegments = new Map<string, V2MapSegment>()

  for (const segment of store.segments.values()) {
    if (segment.roomId !== roomId) {
      continue
    }

    const previousSegment = latestSegments.get(segment.creatorId)

    if (
      !previousSegment ||
      Date.parse(segment.submittedAt) >= Date.parse(previousSegment.submittedAt)
    ) {
      latestSegments.set(segment.creatorId, segment)
    }
  }

  return latestSegments
}

function areAllRoomMembersFinished(room: V2Room, players: V2RaceResultPlayer[]) {
  const playersByUserId = new Map(players.map((player) => [player.userId, player]))

  return room.memberIds.length > 0 &&
    room.memberIds.every((memberId) => typeof playersByUserId.get(memberId)?.raceFinishedAtMs === 'number')
}

function hasAnyRoomMemberFinished(room: V2Room, players: V2RaceResultPlayer[]) {
  const playersByUserId = new Map(players.map((player) => [player.userId, player]))

  return room.memberIds.some((memberId) => typeof playersByUserId.get(memberId)?.raceFinishedAtMs === 'number')
}

function canJoinRoomPhase(room: V2Room) {
  if (room.phase === 'lobby') {
    return true
  }

  if (room.phase !== 'building') {
    return false
  }

  const remainingMs = getRoomPhaseRemainingMs(room)

  return remainingMs !== null && remainingMs >= BUILD_LATE_JOIN_CUTOFF_MS
}

function applyFirstFinishCountdown(store: V2StoreState, room: V2Room, nowMs: number) {
  store.rooms.set(room.id, {
    ...room,
    createdAtMs: nowMs,
    phaseDurationMs: FIRST_FINISH_COUNTDOWN_MS,
  })
}

function startLastDance(store: V2StoreState, room: V2Room, nowMs: number) {
  const updatedRoom: V2Room = {
    ...room,
    createdAtMs: nowMs,
    phaseDurationMs: LAST_DANCE_MS,
    hasOvertime: true,
  }

  store.rooms.set(room.id, updatedRoom)

  return updatedRoom
}

function getRaceDurationMs(segmentCount: number) {
  return Math.max(1, segmentCount) * RACE_MS_PER_LINE
}

function normalizeReadyUserIds(room: Pick<V2Room, 'hostId' | 'readyUserIds'>, memberIds: string[]) {
  return [...new Set([
    ...(room.hostId ? [room.hostId] : []),
    ...room.readyUserIds.filter((userId) => memberIds.includes(userId)),
  ])]
}

function areGuestsReady(room: V2Room) {
  return room.memberIds
    .filter((memberId) => memberId !== room.hostId)
    .every((memberId) => room.readyUserIds.includes(memberId))
}

function toRoomPlayerSnapshot(
  store: V2StoreState,
  room: V2Room,
  userId: string,
): V2RoomPlayerSnapshot {
  const session = getSessionByUserId(store, userId)
  const isHost = room.hostId === userId
  const isReady = isHost || room.readyUserIds.includes(userId)

  return {
    userId,
    user_id: userId,
    nickname: session?.nickname ?? (isHost ? room.hostNickname : '플레이어'),
    isHost,
    is_host: isHost,
    isReady,
    is_ready: isReady,
  }
}

function finalizeRaceTimeout(store: V2StoreState, room: V2Room, nowMs: number) {
  const previousResult = store.raceResults.get(room.id)
  const previousPlayers = new Map(
    previousResult?.players.map((player) => [player.userId, player]) ?? [],
  )
  const players = room.memberIds.map((userId) => {
    const previousPlayer = previousPlayers.get(userId)
    const session = getSessionByUserId(store, userId)
    const segment = [...store.segments.values()].find(
      (candidate) => candidate.roomId === room.id && candidate.creatorId === userId,
    )
    const raceFinishedAtMs = previousPlayer?.raceFinishedAtMs ?? null
    const raceProgress = raceFinishedAtMs !== null
      ? 100
      : previousPlayer?.raceProgress ?? 0
    const raceDistanceToGoal = raceFinishedAtMs !== null
      ? 0
      : previousPlayer?.raceDistanceToGoal ?? Math.max(0, 100 - raceProgress)

    return {
      userId,
      user_id: userId,
      nickname: session?.nickname ?? previousPlayer?.nickname ?? (room.hostId === userId ? room.hostNickname : '플레이어'),
      isHost: room.hostId === userId,
      is_host: room.hostId === userId,
      isReady: true,
      is_ready: true,
      validationCleared: segment?.isValidated ?? previousPlayer?.validationCleared ?? false,
      validation_cleared: segment?.isValidated ?? previousPlayer?.validationCleared ?? false,
      raceProgress,
      race_progress: raceProgress,
      raceFinishedAtMs,
      race_finished_at_ms: raceFinishedAtMs,
      raceDistanceToGoal,
      race_distance_to_goal: raceDistanceToGoal,
      rank: 0,
    }
  })
  const now = new Date(nowMs).toISOString()
  const result: V2RaceResult = {
    roomId: room.id,
    room_id: room.id,
    players: rankRacePlayers(players),
    updatedAt: now,
    updated_at: now,
  }

  store.raceResults.set(room.id, result)
}

function rankRacePlayers(players: V2RaceResultPlayer[]) {
  const sortedPlayers = [...players].sort((left, right) => {
    const leftFinished = left.raceFinishedAtMs !== null
    const rightFinished = right.raceFinishedAtMs !== null

    if (leftFinished && rightFinished) {
      return (left.raceFinishedAtMs ?? 0) - (right.raceFinishedAtMs ?? 0)
    }

    if (leftFinished !== rightFinished) {
      return leftFinished ? -1 : 1
    }

    if (left.raceProgress !== right.raceProgress) {
      return right.raceProgress - left.raceProgress
    }

    return left.raceDistanceToGoal - right.raceDistanceToGoal
  })
  const ranks = new Map(sortedPlayers.map((player, index) => [player.userId, index + 1]))

  return players.map((player) => ({
    ...player,
    rank: ranks.get(player.userId) ?? players.length,
  }))
}

function updateAssetGenerationState(asset: V2Asset, status: AssetStatus, sheetUrl: string | null = null) {
  return {
    ...asset,
    status,
    sprites: asset.sprites.map((sprite) => ({
      ...sprite,
      status,
      sheetUrl: status === 'ready' ? sheetUrl ?? sprite.sheetUrl : sprite.sheetUrl,
      sheet_url: status === 'ready' ? sheetUrl ?? sprite.sheet_url : sprite.sheet_url,
      frameCount: status === 'ready' ? sprite.frameCount ?? 1 : sprite.frameCount,
      frame_count: status === 'ready' ? sprite.frame_count ?? 1 : sprite.frame_count,
    })),
  }
}

function updateAssetSpriteState(
  asset: V2Asset,
  action: AssetSpriteAction,
  status: AssetStatus,
  nowMs: number,
  sheetUrl: string | null = null,
) {
  return {
    ...asset,
    sprites: asset.sprites.map((sprite) =>
      sprite.action === action
        ? {
            ...sprite,
            status,
            sheetUrl: status === 'ready' ? sheetUrl ?? sprite.sheetUrl : sprite.sheetUrl,
            sheet_url: status === 'ready' ? sheetUrl ?? sprite.sheet_url : sprite.sheet_url,
            frameCount: status === 'ready' ? sprite.frameCount ?? 1 : sprite.frameCount,
            frame_count: status === 'ready' ? sprite.frame_count ?? 1 : sprite.frame_count,
            lastRegenAt: new Date(nowMs).toISOString(),
            last_regen_at: new Date(nowMs).toISOString(),
          }
        : sprite,
    ),
  }
}

function createAssetJob(
  store: V2StoreState,
  payload: {
    userId: string
    outputAssetId: string
    targetType: string
    action: AssetSpriteAction | null
    status: AssetStatus
  },
) {
  const nowMs = Date.now()
  const job: V2AssetJob = {
    id: `job-${payload.outputAssetId}-${payload.action ?? 'asset'}-${randomToken(6)}`,
    userId: payload.userId,
    status: payload.status,
    targetType: payload.targetType,
    outputAssetId: payload.outputAssetId,
    action: payload.action,
    errorCode: null,
    errorMessage: null,
    leasedBy: null,
    leaseExpiresAtMs: null,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  }

  store.assetJobs.set(job.id, job)

  return job
}

function expireAssetJobLeases(store: V2StoreState, nowMs: number) {
  for (const job of store.assetJobs.values()) {
    if (job.leaseExpiresAtMs !== null && job.leaseExpiresAtMs <= nowMs && job.status === 'generating') {
      store.assetJobs.set(job.id, {
        ...job,
        status: 'queued',
        leasedBy: null,
        leaseExpiresAtMs: null,
        updatedAtMs: nowMs,
      })
    }
  }
}

function seedSystemAssets(store: V2StoreState) {
  const now = new Date(0).toISOString()
  const assets = [
    normalizeAsset({
      id: 'system-avatar-stick',
      userId: null,
      isSystem: true,
      category: 'avatar',
      name: '기본 아바타',
      description: '바로 게임을 시작할 수 있는 기본 아바타',
      widthCells: null,
      heightCells: null,
      colliderType: 'rect',
      createdAt: now,
    }),
    normalizeAsset({
      id: 'system-platform-solid',
      userId: null,
      isSystem: true,
      category: 'platform',
      name: '튼튼한 발판',
      description: '기본 플랫폼',
      widthCells: 3,
      heightCells: 1,
      colliderType: 'rect',
      createdAt: now,
    }),
    normalizeAsset({
      id: 'system-obstacle-spike',
      userId: null,
      isSystem: true,
      category: 'obstacle',
      name: '회전 장애물',
      description: '기본 장애물',
      widthCells: 1,
      heightCells: 1,
      colliderType: 'rect',
      createdAt: now,
    }),
  ]

  for (const asset of assets) {
    store.assets.set(asset.id, asset)
  }
}

function seedRooms(store: V2StoreState) {
  const seedRoom = createRoom(store, {
    userId: 'system-host',
    name: '공개 릴레이 방',
    isPublic: true,
    maxPlayers: 4,
  })

  store.rooms.set(seedRoom.id, {
    ...seedRoom,
    id: 'mock-room-public-open',
  })
  store.rooms.delete(seedRoom.id)
}

function normalizeAsset(input: {
  id: string
  userId: string | null
  isSystem?: boolean
  category: AssetCategory
  name: string
  description: string
  attrs?: Record<string, string | number | boolean | null>
  colliderType: 'rect' | 'slope' | 'none'
  widthCells: number | null
  heightCells: number | null
  sourceImageUrl?: string
  remixOfId?: string | null
  status?: AssetStatus
  createdAt: string
}): V2Asset {
  const isSystem = input.isSystem === true

  return {
    id: input.id,
    user_id: input.userId,
    userId: input.userId,
    creator_id: input.userId,
    creatorId: input.userId,
    isSystem,
    is_system: isSystem,
    category: input.category,
    name: input.name,
    description: input.description,
    attrs: input.attrs ?? {},
    colliderType: input.colliderType,
    collider_type: input.colliderType,
    widthCells: input.widthCells,
    width_cells: input.widthCells,
    heightCells: input.heightCells,
    height_cells: input.heightCells,
    sourceImageUrl: input.sourceImageUrl ?? '',
    source_image_url: input.sourceImageUrl ?? '',
    remixOfId: input.remixOfId ?? null,
    remix_of_id: input.remixOfId ?? null,
    status: input.status ?? 'ready',
    isPublic: true,
    is_public: true,
    createdAt: input.createdAt,
    created_at: input.createdAt,
    sprites: input.category === 'avatar'
      ? [
          createSprite('idle', input.status ?? 'ready'),
          createSprite('walk', input.status ?? 'ready'),
          createSprite('onair', input.status ?? 'ready'),
        ]
      : [createSprite('static', input.status ?? 'ready')],
  }
}

function createSprite(
  action: V2Asset['sprites'][number]['action'],
  status: AssetStatus,
): V2Asset['sprites'][number] {
  return {
    action,
    status,
    sheetUrl: null,
    sheet_url: null,
    frameCount: null,
    frame_count: null,
    lastRegenAt: null,
    last_regen_at: null,
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/gi, '-').replace(/^-|-$/g, '') || 'relay'
}

function randomToken(length: number) {
  return Math.random().toString(36).slice(2, 2 + length)
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(16)
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}
