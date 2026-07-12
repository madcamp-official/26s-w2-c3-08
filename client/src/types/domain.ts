export type AppView = 'main' | 'avatar' | 'studio' | 'warehouse' | 'lobby' | 'room'

export type WarehouseTab = 'avatar' | 'component'

export type AssetCategory =
  | 'avatar'
  | 'platform'
  | 'obstacle'
  | 'monster'
  | 'background'
  | 'item'

export type AssetStatus = 'queued' | 'generating' | 'ready' | 'failed'

export interface UserSession {
  id: string
  nickname: string
  token: string
  avatarAssetId: string | null
}

export interface DeviceLinkTicket {
  code: string
  expiresAt: string
}

export interface AssetSprite {
  action: 'idle' | 'walk' | 'onair' | 'static'
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
  attrs: Record<string, string | number | boolean | null>
  colliderType: 'rect' | 'slope' | 'none'
  widthCells: number | null
  heightCells: number | null
  sourceImageUrl: string
  remixOfId: string | null
  status: AssetStatus
  isPublic: boolean
  createdAt: string
  sprites: AssetSprite[]
}

export type RoomPhase =
  | 'lobby'
  | 'building'
  | 'validating'
  | 'merging'
  | 'racing'
  | 'finished'

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

export interface RacePositionSnapshot {
  userId: string
  x: number
  y: number
  vx: number
  vy: number
  state: string
  progress: number
  clientTime: number
}

export interface MapPoint {
  x: number
  y: number
}

export interface MapPlacement {
  id: string
  x: number
  y: number
  asset: Asset
}

export interface MapSegmentAssetSnapshot {
  assetId: string
  assetCategory?: AssetCategory
  assetAttrs?: Asset['attrs']
  colliderType?: Asset['colliderType']
  x: number
  y: number
  widthCells: number
  heightCells: number
  rotation: number
}

export interface MapSegmentSnapshot {
  id: string
  roomId: string
  creatorId: string
  startPoint: MapPoint
  endPoint: MapPoint
  placements: MapPlacement[]
  assetRefs: MapSegmentAssetSnapshot[]
  segmentHash: string
  isValidated: boolean
  submittedAt: string
  validatedAt: string | null
  clearTimeMs: number | null
}

export interface MergedMapPlacement {
  assetId: string
  assetCategory?: AssetCategory
  assetAttrs?: Asset['attrs']
  colliderType?: Asset['colliderType']
  sourceSegmentId: string
  x: number
  y: number
  widthCells: number
  heightCells: number
  rotation: number
}

export interface MergedMap {
  id: string
  roomId: string
  globalStart: MapPoint
  globalEnd: MapPoint
  placements: MergedMapPlacement[]
  segments: MapSegmentSnapshot[]
  usedFallback: boolean
  createdAt: string
}

export interface CreateSessionPayload {
  nickname: string
}

export interface CreateAssetPayload {
  userId: string
  category: AssetCategory
  name: string
  description: string
  image: string
  attrs: Record<string, string | number | boolean | null>
  widthCells: number | null
  heightCells: number | null
  remixOfId?: string | null
}

export interface CreateRoomPayload {
  userId: string
  name: string
  isPublic: boolean
  password?: string
  maxPlayers: number
}

export interface JoinRoomPayload {
  userId: string
  password?: string
}

export interface CreateMapSegmentPayload {
  userId: string
  startPoint: MapPoint
  endPoint: MapPoint
  placements: MapPlacement[]
}

export interface ValidateMapSegmentPayload {
  userId: string
  segmentHash: string
  cleared: boolean
  clearTimeMs: number
}
