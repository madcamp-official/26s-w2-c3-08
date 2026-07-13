import type {
  Asset,
  AssetAttrs,
  AssetCategory,
  AssetJob,
  AssetSpriteAction,
  ColliderType,
  CreateAvatarAssetRequest,
  CreateComponentAssetRequest,
  MapPoint,
  MapSegmentMetadata,
  RaceFinishedPayload,
  RacePositionPayload,
  RaceResult,
  RealtimeConnectionStatus,
  RealtimeRoomSnapshot,
  RoomPhase,
  RoomPhaseChangedPayload,
  RoomPlayer,
  RoomSummary,
  RoomTimerTickPayload,
  Session,
  TypedApiError,
} from 'shared/schemas'

export type PortResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PortError }

export type PortError = TypedApiError

export type Unsubscribe = () => void

export interface StorageSlot<TValue = unknown> {
  readonly scope: 'session' | 'mock' | 'preferences' | 'cache'
  readonly name: string
  readonly __value?: TValue
}

export interface SessionPort {
  restoreSession(): Promise<PortResult<Session | null>>
  createSession(payload: { nickname: string }): Promise<PortResult<Session>>
  saveSession(session: Session | null): Promise<PortResult<void>>
}

export interface AssetPort {
  listAssets(userId: string): Promise<PortResult<Asset[]>>
  createAvatarAsset(payload: CreateAvatarAssetRequest): Promise<PortResult<Asset>>
  createComponentAsset(payload: CreateComponentAssetRequest): Promise<PortResult<Asset>>
  getAssetJob(jobId: string): Promise<PortResult<AssetJob>>
  requestSpriteRegeneration(payload: {
    assetId: string
    action: AssetSpriteAction
  }): Promise<PortResult<AssetJob | Asset>>
}

export interface AssetJobUpdates {
  getStatus(): RealtimeConnectionStatus
  subscribe(handler: (job: AssetJob) => void): Unsubscribe
}

export interface RoomPort {
  listRooms(): Promise<PortResult<RoomSummary[]>>
  createRoom(payload: CreateRoomRequest): Promise<PortResult<RoomSummary>>
  joinPublicRoom(userId: string): Promise<PortResult<RoomSummary>>
  joinRoom(roomId: string, payload: JoinRoomRequest): Promise<PortResult<RoomSummary>>
  saveMapSegment(payload: SaveMapSegmentRequest): Promise<PortResult<MapSegmentMetadata>>
  validateMapSegment(payload: ValidateMapSegmentRequest): Promise<PortResult<MapSegmentMetadata>>
  mergeRoomMap(roomId: string): Promise<PortResult<MergedMapMetadata>>
}

export interface RoomRealtime {
  getStatus(): RealtimeConnectionStatus
  connect(session: Session, handlers: RoomRealtimeHandlers): Promise<PortResult<void>>
  disconnect(): void
  joinRoom(payload: { roomId: string; userId: string; nickname: string; isHost?: boolean }): void
  leaveRoom(payload: { roomId: string; userId: string }): void
  setReady(payload: { roomId: string; userId: string; isReady: boolean }): void
  startRoom(payload: { roomId: string; userId: string }): void
  markPhaseReady(payload: { roomId: string; userId: string; phase: RoomPhase }): void
  requestTimeVote(payload: { roomId: string; userId: string; phase: RoomPhase; deltaSec: number }): void
  submitSegment(payload: { roomId: string; userId: string; segmentId: string }): void
  publishValidationResult(payload: {
    roomId: string
    userId: string
    cleared: boolean
    segmentHash: string
    clearTimeMs: number
  }): void
}

export interface GameRealtime {
  getStatus(): RealtimeConnectionStatus
  sendRacePosition(payload: RacePositionPayload): void
  finishRace(payload: RaceFinishedPayload): void
  subscribe(handlers: GameRealtimeHandlers): Unsubscribe
}

export interface StoragePort {
  getJson<T>(slot: StorageSlot<T>): PortResult<T | null>
  setJson<T>(slot: StorageSlot<T>, value: T): PortResult<void>
  remove(slot: StorageSlot): PortResult<void>
}

export interface RoomRealtimeHandlers {
  onStatusChange?: (status: RealtimeConnectionStatus) => void
  onRoomJoined?: (snapshot: RealtimeRoomSnapshot) => void
  onRoomStateChanged?: (snapshot: RealtimeRoomSnapshot) => void
  onPhaseChanged?: (payload: RoomPhaseChangedPayload) => void
  onTimerTick?: (payload: RoomTimerTickPayload) => void
  onTimeVoteUpdated?: (payload: TimeVoteUpdatedPayload) => void
  onSegmentSubmitted?: (payload: SegmentSubmittedPayload) => void
  onValidationResult?: (payload: ValidationResultPayload) => void
  onMapMerged?: (payload: MergedMapMetadata) => void
  onResultsFinal?: (payload: RaceResult) => void
}

export interface GameRealtimeHandlers {
  onRacePosition?: (payload: RacePositionPayload) => void
  onRaceFinished?: (payload: RaceFinishedPayload) => void
  onResultsFinal?: (payload: RaceResult) => void
}

export interface CreateRoomRequest {
  userId: string
  name: string
  isPublic: boolean
  password?: string
  maxPlayers: 2 | 3 | 4
}

export interface JoinRoomRequest {
  userId: string
  password?: string
}

export interface MapSegmentAssetRef {
  assetId: string
  assetCategory?: AssetCategory
  assetAttrs?: AssetAttrs
  colliderType?: ColliderType
  x: number
  y: number
  widthCells: number
  heightCells: number
  rotation: number
}

export interface SaveMapSegmentRequest {
  roomId: string
  userId: string
  startPoint: MapPoint
  endPoint: MapPoint
  assets: MapSegmentAssetRef[]
}

export interface ValidateMapSegmentRequest {
  roomId: string
  userId: string
  segmentHash: string
  cleared: boolean
  clearTimeMs: number
}

export interface MergedMapMetadata {
  id: string
  roomId: string
  usedFallback: boolean
  createdAt: string
}

export interface TimeVoteUpdatedPayload {
  roomId: string
  phase: RoomPhase
  deltaSec: number
  voterIds: string[]
  approved: boolean
  applied: boolean
  remainingMs?: number
  phaseEndsAt?: string | null
}

export interface SegmentSubmittedPayload {
  roomId?: string
  userId: string
  segmentId: string
}

export interface ValidationResultPayload {
  roomId?: string
  userId: string
  cleared: boolean
  segmentHash?: string
  clearTimeMs?: number
  penaltyMs?: number
}

export interface RoomRosterSnapshot {
  room: RoomSummary
  players: RoomPlayer[]
}
