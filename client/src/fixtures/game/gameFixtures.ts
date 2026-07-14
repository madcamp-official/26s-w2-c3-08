import type {
  Asset,
  MapPlacement,
  MapPoint,
  MapSegmentSnapshot,
  MergedMap,
  RacePositionSnapshot,
  RoomPlayer,
} from '../../types/domain'

export type GameFixtureViewport = '1280x720' | '1440x900' | '1920x1080'

export interface MapBuildFixture {
  id: string
  screenId: 'S4_MAP_BUILD'
  title: string
  description: string
  state:
    | 'editing'
    | 'selectedAsset'
    | 'placementDenied'
    | 'locked'
    | 'timeVotePending'
    | 'buildTest'
    | 'submitPending'
    | 'submitComplete'
  viewport: GameFixtureViewport
  roomId: string
  remainingMs: number | null
  budgetUsed: number
  budgetLimit: number
  assets: Asset[]
  placements: MapPlacement[]
  selectedAssetId: string
  selectedPlacementId: string
  tool: 'select' | 'place' | 'move' | 'erase' | 'start' | 'goal'
  startPoint: MapPoint
  endPoint: MapPoint
  isLocked: boolean
  message: string
  timeVoteText: string
  players: RoomPlayer[]
  testSegment: MapSegmentSnapshot
}

export interface ValidationFixture {
  id: string
  screenId: 'D_VALIDATION'
  title: string
  description: string
  state: 'playing' | 'cleared' | 'failedRecorded' | 'allWaiting' | 'timeout' | 'noSegment'
  viewport: GameFixtureViewport
  roomId: string
  remainingMs: number | null
  segment: MapSegmentSnapshot | null
  players: RoomPlayer[]
  isCleared: boolean
  resetSignal: number
  message: string
}

export interface MergingFixture {
  id: string
  screenId: 'M_MERGING'
  title: string
  description: string
  state: 'merging' | 'validatedSegments' | 'fallback' | 'error'
  viewport: GameFixtureViewport
  roomId: string
  progress: number
  validatedSegments: number
  globalPlacements: number
  usedFallback: boolean
  message: string
  mergedMap: MergedMap | null
}

export interface RaceFixture {
  id: string
  screenId: 'E_RACE'
  title: string
  description: string
  state: 'normal' | 'freezePenalty' | 'overtime' | 'playerFinished' | 'missingMap' | 'finish'
  viewport: GameFixtureViewport
  roomId: string
  remainingMs: number | null
  elapsedSeconds: number
  isExtended: boolean
  currentUserId: string
  players: RoomPlayer[]
  mergedMap: MergedMap | null
  racePositions: Record<string, RacePositionSnapshot>
  message: string
}

export interface ResultsFixture {
  id: string
  screenId: 'F_RESULTS'
  title: string
  description: string
  state: 'winner' | 'unfinished' | 'localHighlight' | 'offline' | 'empty'
  viewport: GameFixtureViewport
  roomId: string
  players: RoomPlayer[]
  currentUserId: string
  stale: boolean
}

export type GameScreenFixture =
  | MapBuildFixture
  | ValidationFixture
  | MergingFixture
  | RaceFixture
  | ResultsFixture

const createdAt = '2026-07-14T00:00:00.000Z'

export const platformAsset: Asset = createAsset({
  id: 'system-platform-solid',
  category: 'platform',
  name: '튼튼한 발판',
  widthCells: 3,
  heightCells: 1,
  colliderType: 'rect',
  attrs: {
    schemaVersion: 'asset-attributes-v1',
    category: 'platform',
    collisionMode: 'solid',
    materialization: 'always',
    movementMode: 'fixed',
    shape: 'rect',
  },
})

export const slopeAsset: Asset = createAsset({
  id: 'system-platform-slope',
  category: 'platform',
  name: '오르막 경사',
  widthCells: 2,
  heightCells: 1,
  colliderType: 'slope',
  attrs: {
    schemaVersion: 'asset-attributes-v1',
    category: 'platform',
    collisionMode: 'solid',
    materialization: 'always',
    movementMode: 'fixed',
    shape: 'slope-floor-asc',
  },
})

export const obstacleAsset: Asset = createAsset({
  id: 'system-obstacle-spike',
  category: 'obstacle',
  name: '회전 장애물',
  widthCells: 1,
  heightCells: 1,
  colliderType: 'rect',
  attrs: {
    schemaVersion: 'asset-attributes-v1',
    category: 'obstacle',
    contactEffect: 'damage',
    triggerMode: 'always',
    motionMode: 'fixed',
  },
})

export const monsterAsset: Asset = createAsset({
  id: 'system-monster-patrol',
  category: 'monster',
  name: '순찰 로봇',
  widthCells: 1,
  heightCells: 1,
  colliderType: 'rect',
  attrs: {
    schemaVersion: 'asset-attributes-v1',
    category: 'monster',
    moveType: 'ground-walk-normal',
    stompReaction: 'bounce',
    health: 'normal',
  },
})

export const backgroundAsset: Asset = createAsset({
  id: 'system-background-sky',
  category: 'background',
  name: '하늘 배경',
  widthCells: 4,
  heightCells: 2,
  colliderType: 'none',
  attrs: {
    schemaVersion: 'asset-attributes-v1',
    category: 'background',
    renderMode: 'decorative-static',
  },
})

export const gameAssets = [
  platformAsset,
  slopeAsset,
  obstacleAsset,
  monsterAsset,
  backgroundAsset,
]

export const mapPlacements: MapPlacement[] = [
  { id: 'placement-start-1', x: 1, y: 8, asset: platformAsset },
  { id: 'placement-mid-1', x: 6, y: 7, asset: platformAsset },
  { id: 'placement-slope-1', x: 10, y: 7, asset: slopeAsset },
  { id: 'placement-obstacle-1', x: 14, y: 8, asset: obstacleAsset },
  { id: 'placement-monster-1', x: 17, y: 7, asset: monsterAsset },
  { id: 'placement-goal-1', x: 20, y: 8, asset: platformAsset },
]

export const startPoint: MapPoint = { x: 1, y: 7 }
export const endPoint: MapPoint = { x: 22, y: 7 }

export const roomPlayers: RoomPlayer[] = [
  createPlayer({
    id: 'player-local',
    nickname: '나의닉네임',
    isHost: true,
    isReady: false,
    validationCleared: true,
    raceProgress: 78,
    raceFinishedAtMs: null,
    raceDistanceToGoal: 22,
  }),
  createPlayer({
    id: 'player-green',
    nickname: '초록손님',
    isHost: false,
    isReady: true,
    validationCleared: false,
    raceProgress: 64,
    raceFinishedAtMs: null,
    raceDistanceToGoal: 38,
  }),
  createPlayer({
    id: 'player-orange',
    nickname: '주황러너',
    isHost: false,
    isReady: true,
    validationCleared: true,
    raceProgress: 100,
    raceFinishedAtMs: 92_480,
    raceDistanceToGoal: 0,
  }),
]

export const mapSegment: MapSegmentSnapshot = {
  id: 'segment-local',
  roomId: 'fixture-room',
  creatorId: 'player-local',
  startPoint,
  endPoint,
  placements: mapPlacements,
  assetRefs: mapPlacements.map((placement) => ({
    assetId: placement.asset.id,
    assetCategory: placement.asset.category,
    assetAttrs: placement.asset.attrs,
    colliderType: placement.asset.colliderType,
    x: placement.x,
    y: placement.y,
    widthCells: Math.max(1, placement.asset.widthCells ?? 1),
    heightCells: Math.max(1, placement.asset.heightCells ?? 1),
    rotation: 0,
  })),
  segmentHash: 'segment-fixture-001',
  isValidated: true,
  submittedAt: createdAt,
  validatedAt: createdAt,
  clearTimeMs: 61_400,
}

export const mergedMap: MergedMap = {
  id: 'merged-fixture-map',
  roomId: 'fixture-room',
  globalStart: startPoint,
  globalEnd: { x: 46, y: 7 },
  placements: [
    ...mapSegment.assetRefs.map((assetRef) => ({
      ...assetRef,
      sourceSegmentId: mapSegment.id,
    })),
    ...mapSegment.assetRefs.map((assetRef) => ({
      ...assetRef,
      sourceSegmentId: 'segment-green',
      x: assetRef.x + 24,
    })),
  ],
  segments: [mapSegment],
  usedFallback: false,
  createdAt,
}

export const racePositions: Record<string, RacePositionSnapshot> = {
  'player-green': {
    userId: 'player-green',
    x: 620,
    y: 252,
    vx: 0,
    vy: 0,
    state: 'running',
    progress: 64,
    clientTime: 9_200,
  },
}

const baseMapBuildFixture: MapBuildFixture = {
  id: 's4-map-build-editing',
  screenId: 'S4_MAP_BUILD',
  title: '맵 제작',
  description: '24x10 Phaser board와 React HUD를 함께 표시합니다.',
  state: 'editing',
  viewport: '1440x900',
  roomId: 'fixture-room',
  remainingMs: 178_000,
  budgetUsed: 13,
  budgetLimit: 24,
  assets: gameAssets,
  placements: mapPlacements,
  selectedAssetId: platformAsset.id,
  selectedPlacementId: '',
  tool: 'place',
  startPoint,
  endPoint,
  isLocked: false,
  message: '에셋을 선택한 뒤 보드 칸을 누르면 배치합니다.',
  timeVoteText: '시간 투표 가능',
  players: roomPlayers,
  testSegment: mapSegment,
}

export const mapBuildFixtures: MapBuildFixture[] = [
  baseMapBuildFixture,
  {
    ...baseMapBuildFixture,
    id: 's4-map-build-selected-asset',
    title: '선택 에셋',
    state: 'selectedAsset',
    selectedAssetId: obstacleAsset.id,
    message: '회전 장애물 선택 · 배치 가능한 칸을 고르세요.',
  },
  {
    ...baseMapBuildFixture,
    id: 's4-map-build-placement-denied',
    title: '배치 거절',
    state: 'placementDenied',
    selectedAssetId: monsterAsset.id,
    budgetUsed: 24,
    message: '예산을 초과해 배치할 수 없어요.',
  },
  {
    ...baseMapBuildFixture,
    id: 's4-map-build-locked',
    title: '맵 잠김',
    state: 'locked',
    isLocked: true,
    message: '제출 완료 후에는 맵을 수정할 수 없습니다.',
  },
  {
    ...baseMapBuildFixture,
    id: 's4-map-build-test-modal',
    title: '빌드 테스트',
    state: 'buildTest',
    message: '테스트 modal에서 PlaytestCanvas를 실행합니다.',
  },
  {
    ...baseMapBuildFixture,
    id: 's4-map-build-submit-complete',
    title: '제출 완료',
    state: 'submitComplete',
    isLocked: true,
    players: roomPlayers.map((player) =>
      player.id === 'player-local' ? { ...player, isReady: true } : player,
    ),
    message: '맵 잠김 · 저장된 스냅샷을 검증합니다.',
  },
]

export const validationFixtures: ValidationFixture[] = [
  {
    id: 'd-validation-playing',
    screenId: 'D_VALIDATION',
    title: '검증 플레이',
    description: 'PlaytestCanvas와 검증 HUD를 표시합니다.',
    state: 'playing',
    viewport: '1440x900',
    roomId: 'fixture-room',
    remainingMs: 84_000,
    segment: mapSegment,
    players: roomPlayers.map((player) => ({ ...player, isReady: false })),
    isCleared: false,
    resetSignal: 0,
    message: 'GOAL에 닿으면 검증 성공으로 기록됩니다.',
  },
  {
    id: 'd-validation-cleared',
    screenId: 'D_VALIDATION',
    title: '검증 성공',
    description: 'local clear record가 저장된 상태입니다.',
    state: 'cleared',
    viewport: '1440x900',
    roomId: 'fixture-room',
    remainingMs: 58_000,
    segment: mapSegment,
    players: roomPlayers,
    isCleared: true,
    resetSignal: 1,
    message: '검증 성공 기록 완료 · 다른 플레이어 대기',
  },
  {
    id: 'd-validation-no-segment',
    screenId: 'D_VALIDATION',
    title: '검증 세그먼트 없음',
    description: 'currentSegment가 없는 오류 상태입니다.',
    state: 'noSegment',
    viewport: '1280x720',
    roomId: 'fixture-room',
    remainingMs: null,
    segment: null,
    players: roomPlayers,
    isCleared: false,
    resetSignal: 0,
    message: '검증할 맵 스냅샷이 없습니다.',
  },
]

export const mergingFixtures: MergingFixture[] = [
  {
    id: 'm-merging-progress',
    screenId: 'M_MERGING',
    title: '맵 병합 중',
    description: 'validated segment를 전역 맵으로 병합합니다.',
    state: 'merging',
    viewport: '1280x720',
    roomId: 'fixture-room',
    progress: 62,
    validatedSegments: 2,
    globalPlacements: mergedMap.placements.length,
    usedFallback: false,
    message: '검증 성공 세그먼트를 이어붙이고 있어요.',
    mergedMap,
  },
  {
    id: 'm-merging-fallback',
    screenId: 'M_MERGING',
    title: 'fallback 병합',
    description: '검증 성공 세그먼트가 없어 기본 세그먼트를 사용합니다.',
    state: 'fallback',
    viewport: '1280x720',
    roomId: 'fixture-room',
    progress: 100,
    validatedSegments: 0,
    globalPlacements: mapSegment.assetRefs.length,
    usedFallback: true,
    message: '검증 성공 세그먼트가 없어 기본 세그먼트를 사용합니다.',
    mergedMap: { ...mergedMap, usedFallback: true },
  },
]

export const raceFixtures: RaceFixture[] = [
  {
    id: 'e-race-normal',
    screenId: 'E_RACE',
    title: '레이스',
    description: 'RaceCanvas와 React ranking HUD를 표시합니다.',
    state: 'normal',
    viewport: '1440x900',
    roomId: 'fixture-room',
    remainingMs: 174_000,
    elapsedSeconds: 126,
    isExtended: false,
    currentUserId: 'player-local',
    players: roomPlayers,
    mergedMap,
    racePositions,
    message: 'A/D 또는 방향키, Space, S/down으로 플레이합니다.',
  },
  {
    id: 'e-race-freeze',
    screenId: 'E_RACE',
    title: 'freeze penalty',
    description: '검증 실패자의 15초 freeze를 HUD에 표시합니다.',
    state: 'freezePenalty',
    viewport: '1440x900',
    roomId: 'fixture-room',
    remainingMs: 285_000,
    elapsedSeconds: 15,
    isExtended: false,
    currentUserId: 'player-green',
    players: roomPlayers,
    mergedMap,
    racePositions,
    message: '검증 실패자는 시작 시 15초 동안 움직일 수 없어요.',
  },
  {
    id: 'e-race-overtime',
    screenId: 'E_RACE',
    title: '연장전',
    description: '완주자가 없을 때 30초 overtime 상태입니다.',
    state: 'overtime',
    viewport: '1440x900',
    roomId: 'fixture-room',
    remainingMs: 22_000,
    elapsedSeconds: 308,
    isExtended: true,
    currentUserId: 'player-local',
    players: roomPlayers.map((player) => ({ ...player, raceFinishedAtMs: null })),
    mergedMap,
    racePositions,
    message: '30초 연장전 · 현재 위치 기준 순위 산정',
  },
  {
    id: 'e-race-missing-map',
    screenId: 'E_RACE',
    title: '병합 맵 없음',
    description: 'mergedMap이 없는 오류 상태입니다.',
    state: 'missingMap',
    viewport: '1280x720',
    roomId: 'fixture-room',
    remainingMs: null,
    elapsedSeconds: 0,
    isExtended: false,
    currentUserId: 'player-local',
    players: roomPlayers,
    mergedMap: null,
    racePositions: {},
    message: '레이스 맵을 찾을 수 없습니다.',
  },
]

export const resultsFixtures: ResultsFixture[] = [
  {
    id: 'f-results-winner',
    screenId: 'F_RESULTS',
    title: '최종 순위',
    description: 'winner와 local highlight를 표시합니다.',
    state: 'winner',
    viewport: '1280x720',
    roomId: 'fixture-room',
    players: roomPlayers,
    currentUserId: 'player-local',
    stale: false,
  },
  {
    id: 'f-results-offline',
    screenId: 'F_RESULTS',
    title: '오프라인 결과',
    description: '마지막 local ranking을 stale indicator와 함께 표시합니다.',
    state: 'offline',
    viewport: '1280x720',
    roomId: 'fixture-room',
    players: roomPlayers.map((player) => ({ ...player, raceFinishedAtMs: null })),
    currentUserId: 'player-local',
    stale: true,
  },
]

export const gameScreenFixtures: GameScreenFixture[] = [
  ...mapBuildFixtures,
  ...validationFixtures,
  ...mergingFixtures,
  ...raceFixtures,
  ...resultsFixtures,
]

export type GameScreenFixtureId = (typeof gameScreenFixtures)[number]['id']

export function getGameScreenFixture(id: string | undefined) {
  return gameScreenFixtures.find((fixture) => fixture.id === id) ?? mapBuildFixtures[0]
}

function createAsset(patch: Partial<Asset> & Pick<Asset, 'id' | 'category' | 'name'>): Asset {
  return {
    creatorId: null,
    isSystem: true,
    description: `${patch.name} 시스템 에셋`,
    attrs: {},
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: true,
    createdAt,
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: null, lastRegenAt: null }],
    ...patch,
  }
}

function createPlayer(patch: RoomPlayer): RoomPlayer {
  return patch
}
