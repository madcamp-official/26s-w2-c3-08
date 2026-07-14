import type {
  Asset,
  CreateAssetPayload,
  CreateMapSegmentPayload,
  CreateRoomPayload,
  CreateSessionPayload,
  DeviceLinkTicket,
  JoinRoomPayload,
  MapPlacement,
  MapPoint,
  MapSegmentAssetSnapshot,
  MapSegmentSnapshot,
  RoomSummary,
  MergedMap,
  UserSession,
  ValidateMapSegmentPayload,
} from '../types/domain'
import { createClientId } from '../utils/id'

const SESSION_KEY = 'relay.session'
const SESSION_PROFILE_KEY = 'relay.session.profileId'
const MOCK_ASSETS_KEY = 'relay.mock.assets'
const MOCK_DEVICE_LINKS_KEY = 'relay.mock.deviceLinks'
const MOCK_MAP_SEGMENTS_KEY = 'relay.mock.mapSegments'
const MOCK_ROOM_PASSWORDS_KEY = 'relay.mock.roomPasswords'
const MOCK_ROOMS_KEY = 'relay.mock.rooms'
const MOCK_ROOM_CAPACITY_MIGRATION_KEY = 'relay.mock.rooms.capacityMigration.v1'
const DEVICE_LINK_TTL_MS = 5 * 60 * 1000
const viteEnv = (import.meta.env ?? {}) as Partial<ImportMetaEnv>
const REMOTE_API_ENABLED = viteEnv.VITE_REMOTE_API === 'true'

interface ApiResult<T> {
  data: T
  source: 'api' | 'mock'
}

interface StoredDeviceLink extends DeviceLinkTicket {
  session: UserSession
  createdAt: string
}

const defaultRooms: RoomSummary[] = [
  {
    id: 'room-public-1',
    name: '그리드 점프 연습방',
    hostId: null,
    hostNickname: 'maker01',
    isPublic: true,
    players: 2,
    maxPlayers: 4,
    phase: 'lobby',
    elapsedSeconds: 0,
    phaseEndsAt: null,
  },
  {
    id: 'room-private-1',
    name: '비밀 점프 테스트',
    hostId: null,
    hostNickname: 'builder',
    isPublic: false,
    players: 1,
    maxPlayers: 4,
    phase: 'lobby',
    elapsedSeconds: 0,
    phaseEndsAt: null,
  },
  {
    id: 'room-racing-1',
    name: '저녁 릴레이 레이스',
    hostId: null,
    hostNickname: 'runner',
    isPublic: true,
    players: 4,
    maxPlayers: 4,
    phase: 'racing',
    elapsedSeconds: 103,
    phaseEndsAt: null,
  },
]

const starterAssets: Asset[] = [
  {
    id: 'system-avatar-stick',
    creatorId: null,
    isSystem: true,
    category: 'avatar',
    name: '졸라맨',
    description: '기본 제공 아바타',
    attrs: {},
    colliderType: 'rect',
    widthCells: null,
    heightCells: null,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [
      { action: 'idle', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
      { action: 'walk', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
      { action: 'onair', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
    ],
  },
  {
    id: 'system-platform-grass',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: '잔디 발판',
    description: '기본 제공 지형',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'solid',
      materialization: 'always',
      movementMode: 'fixed',
      shape: 'rectangle',
      surfaceEffect: 'none',
      contactReaction: 'none',
    },
    colliderType: 'rect',
    widthCells: 2,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-platform-donut',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: '도넛 발판',
    description: '밟으면 2초 뒤 아래로 떨어졌다가 5초 후 복구되는 기본 발판',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'one-way-up',
      materialization: 'always',
      movementMode: 'fixed',
      shape: 'rectangle',
      surfaceEffect: 'none',
      contactReaction: 'fall-after-touch',
    },
    colliderType: 'rect',
    widthCells: 2,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-platform-hidden',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: '숨겨진 블록',
    description: '아래에서 치면 모습을 드러내고 실체화되는 기본 블록',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'solid',
      materialization: 'hidden-on-hit',
      movementMode: 'fixed',
      shape: 'rectangle',
      surfaceEffect: 'none',
      contactReaction: 'none',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-platform-crumble',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: '부서지는 블록',
    description: '밟으면 2초 뒤 사라졌다가 5초 후 복구되는 기본 발판',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'solid',
      materialization: 'always',
      movementMode: 'fixed',
      shape: 'rectangle',
      surfaceEffect: 'none',
      contactReaction: 'break-after-touch',
    },
    colliderType: 'rect',
    widthCells: 2,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-platform-slope',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: '오르막 경사',
    description: '내려찍기 후 슬라이딩을 테스트할 수 있는 기본 경사 지형',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'solid',
      materialization: 'always',
      movementMode: 'fixed',
      shape: 'slope-floor-desc',
      contactReaction: 'none',
      surface: 'normal',
    },
    colliderType: 'slope',
    widthCells: 2,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-platform-blink',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: '점멸 블록',
    description: '일정 주기로 실체화와 비활성 상태가 바뀌는 기본 발판',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'solid',
      materialization: 'blink-normal',
      movementMode: 'fixed',
      shape: 'rectangle',
      surfaceEffect: 'none',
      contactReaction: 'none',
    },
    colliderType: 'rect',
    widthCells: 2,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-platform-switch-on',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: 'ON 블록',
    description: '스위치가 ON일 때만 실체화되는 기본 발판',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'solid',
      materialization: 'switch-on',
      movementMode: 'fixed',
      shape: 'rectangle',
      surfaceEffect: 'none',
      contactReaction: 'none',
    },
    colliderType: 'rect',
    widthCells: 2,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-platform-switch-off',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: 'OFF 블록',
    description: '스위치가 OFF일 때만 실체화되는 기본 발판',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'solid',
      materialization: 'switch-off',
      movementMode: 'fixed',
      shape: 'rectangle',
      surfaceEffect: 'none',
      contactReaction: 'none',
    },
    colliderType: 'rect',
    widthCells: 2,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-platform-lift',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: '왕복 리프트',
    description: '좌우로 왕복 이동하는 기본 리프트',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'one-way-up',
      materialization: 'always',
      movementMode: 'patrol-normal',
      shape: 'rectangle',
      surfaceEffect: 'none',
      contactReaction: 'none',
    },
    colliderType: 'rect',
    widthCells: 2,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-platform-step-lift',
    creatorId: null,
    isSystem: true,
    category: 'platform',
    name: '밟으면 이동 리프트',
    description: '플레이어가 밟은 뒤부터 한 방향으로 이동하는 기본 리프트',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'platform',
      collisionMode: 'one-way-up',
      materialization: 'always',
      movementMode: 'step-one-way',
      shape: 'rectangle',
      surfaceEffect: 'none',
      contactReaction: 'none',
    },
    colliderType: 'rect',
    widthCells: 2,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-obstacle-spike',
    creatorId: null,
    isSystem: true,
    category: 'obstacle',
    name: '가시 장애물',
    description: '기본 제공 장애물',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'obstacle',
      contactEffect: 'damage',
      hitSurface: 'all',
      triggerMode: 'always',
      actionMode: 'fixed',
      projectile: 'none',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-obstacle-firebar',
    creatorId: null,
    isSystem: true,
    category: 'obstacle',
    name: '회전 화염봉',
    description: '제자리 회전 동작을 확인할 수 있는 기본 장애물',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'obstacle',
      contactEffect: 'damage',
      hitSurface: 'all',
      triggerMode: 'always',
      actionMode: 'rotate-normal',
      projectile: 'none',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-obstacle-burner',
    creatorId: null,
    isSystem: true,
    category: 'obstacle',
    name: '주기 버너',
    description: '주기적으로 활성/비활성 상태가 바뀌는 기본 장애물',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'obstacle',
      contactEffect: 'damage',
      hitSurface: 'all',
      triggerMode: 'cycle-normal',
      actionMode: 'fixed',
      projectile: 'none',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 2,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-obstacle-thwomp',
    creatorId: null,
    isSystem: true,
    category: 'obstacle',
    name: '감지 쿵쿵',
    description: '플레이어가 아래쪽 축에 들어오면 내려찍는 기본 장애물',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'obstacle',
      contactEffect: 'damage',
      hitSurface: 'top-safe',
      triggerMode: 'proximity-x',
      actionMode: 'charge-down',
      projectile: 'none',
    },
    colliderType: 'rect',
    widthCells: 2,
    heightCells: 2,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-obstacle-cannon',
    creatorId: null,
    isSystem: true,
    category: 'obstacle',
    name: '발사 대포',
    description: '플레이어 방향으로 직선탄을 주기적으로 발사하는 기본 장애물',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'obstacle',
      contactEffect: 'damage',
      hitSurface: 'all',
      triggerMode: 'always',
      actionMode: 'fixed',
      projectile: 'straight-normal',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-monster-walker',
    creatorId: null,
    isSystem: true,
    category: 'monster',
    name: '걷는 몬스터',
    description: '기본 제공 적군. 배치와 검증 플레이 테스트용',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'monster',
      moveType: 'ground-walk-normal',
      tracking: 'none',
      ledgeBehavior: 'fall',
      stompReaction: 'kill',
      health: '1',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [
      { action: 'idle', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
      { action: 'walk', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
    ],
  },
  {
    id: 'system-monster-chaser',
    creatorId: null,
    isSystem: true,
    category: 'monster',
    name: '추적 몬스터',
    description: '플레이어 쪽으로 계속 다가오는 기본 추적 몬스터',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'monster',
      moveType: 'flying',
      tracking: 'always',
      ledgeBehavior: 'fall',
      stompReaction: 'harmful',
      health: '1',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [
      { action: 'idle', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
      { action: 'walk', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
    ],
  },
  {
    id: 'system-monster-gaze',
    creatorId: null,
    isSystem: true,
    category: 'monster',
    name: '시선 반응 몬스터',
    description: '바라보면 멈추고 등 돌리면 다가오는 기본 몬스터',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'monster',
      moveType: 'flying',
      tracking: 'gaze-freeze',
      ledgeBehavior: 'fall',
      stompReaction: 'harmful',
      health: '1',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [
      { action: 'idle', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
      { action: 'walk', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
    ],
  },
  {
    id: 'system-monster-revive',
    creatorId: null,
    isSystem: true,
    category: 'monster',
    name: '부활 몬스터',
    description: '절벽에서 방향을 바꾸고, 밟으면 잠시 기절했다가 다시 나타나는 기본 몬스터',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'monster',
      moveType: 'ground-walk-normal',
      tracking: 'near',
      ledgeBehavior: 'turn',
      stompReaction: 'stun-normal',
      health: '1',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [
      { action: 'idle', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
      { action: 'walk', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
    ],
  },
  {
    id: 'system-monster-tough',
    creatorId: null,
    isSystem: true,
    category: 'monster',
    name: '튼튼 몬스터',
    description: '세 번 밟아야 처치되는 기본 몬스터',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'monster',
      moveType: 'ground-walk-normal',
      tracking: 'none',
      ledgeBehavior: 'turn',
      stompReaction: 'kill',
      health: '3',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [
      { action: 'idle', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
      { action: 'walk', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
    ],
  },
  {
    id: 'system-monster-trampoline',
    creatorId: null,
    isSystem: true,
    category: 'monster',
    name: '트램펄린 몬스터',
    description: '밟으면 사라지지 않고 높게 튕겨 올려주는 기본 몬스터',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'monster',
      moveType: 'static',
      tracking: 'none',
      ledgeBehavior: 'fall',
      stompReaction: 'trampoline',
      health: '1',
    },
    colliderType: 'rect',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [
      { action: 'idle', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
      { action: 'walk', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null },
    ],
  },
  {
    id: 'system-item-speed',
    creatorId: null,
    isSystem: true,
    category: 'item',
    name: '가속 아이템',
    description: '기본 제공 아이템. 레이스 보상 배치용',
    attrs: { effect: 'speed-boost' },
    colliderType: 'none',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-item-giant-mushroom',
    creatorId: null,
    isSystem: true,
    category: 'item',
    name: '거대버섯',
    description: '몸집이 커지고 피해를 한 번 버티는 기본 아이템',
    attrs: { effect: 'giant-mushroom' },
    colliderType: 'none',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-item-switch',
    creatorId: null,
    isSystem: true,
    category: 'item',
    name: 'ON/OFF 스위치',
    description: '닿을 때마다 스위치 블록의 실체화 상태를 바꾸는 기본 장치',
    attrs: { effect: 'toggle-switch' },
    colliderType: 'none',
    widthCells: 1,
    heightCells: 1,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
  {
    id: 'system-background-hills',
    creatorId: null,
    isSystem: true,
    category: 'background',
    name: '언덕 배경',
    description: '충돌 없는 기본 배경 장식',
    attrs: {
      schemaVersion: 'asset-attributes-v1',
      category: 'background',
      renderMode: 'decorative-static',
    },
    colliderType: 'none',
    widthCells: 3,
    heightCells: 2,
    sourceImageUrl: '',
    remixOfId: null,
    status: 'ready',
    isPublic: false,
    createdAt: new Date(0).toISOString(),
    sprites: [{ action: 'static', status: 'ready', sheetUrl: null, frameCount: 1, lastRegenAt: null }],
  },
]

export function getStoredSession() {
  return readStorage<UserSession>(getSessionStorageKey())
}

export function saveStoredSession(session: UserSession | null) {
  const sessionStorageKey = getSessionStorageKey()

  if (session === null) {
    removeStorageItem(sessionStorageKey)
    return
  }

  writeStorage(sessionStorageKey, session)
}

export async function createSession(
  payload: CreateSessionPayload,
): Promise<ApiResult<UserSession>> {
  const apiSession = await postJson<UserSession>('/api/session', payload)

  if (apiSession !== null) {
    saveStoredSession(apiSession)
    return { data: apiSession, source: 'api' }
  }

  const mockSession: UserSession = {
    id: createClientId('session'),
    nickname: payload.nickname,
    token: createClientId('token'),
    avatarAssetId: null,
  }

  saveStoredSession(mockSession)
  return { data: mockSession, source: 'mock' }
}

export async function createDeviceLinkCode(
  session: UserSession,
): Promise<ApiResult<DeviceLinkTicket>> {
  const apiTicket = await postJson<DeviceLinkTicket>('/api/device-link-codes', {
    user_id: session.id,
  })

  if (apiTicket !== null) {
    return { data: apiTicket, source: 'api' }
  }

  const ticket: StoredDeviceLink = {
    code: makeDeviceLinkCode(),
    session,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + DEVICE_LINK_TTL_MS).toISOString(),
  }
  const links = getValidMockDeviceLinks().filter((link) => link.session.id !== session.id)

  writeStorage(MOCK_DEVICE_LINKS_KEY, [ticket, ...links])

  return {
    data: { code: ticket.code, expiresAt: ticket.expiresAt },
    source: 'mock',
  }
}

export async function consumeDeviceLinkCode(code: string): Promise<ApiResult<UserSession> | null> {
  const normalizedCode = normalizeDeviceLinkCode(code)

  if (normalizedCode.length === 0) {
    return null
  }

  const apiSession = await postJson<UserSession>('/api/device-link-codes/consume', {
    code: normalizedCode,
  })

  if (apiSession !== null) {
    saveStoredSession(apiSession)
    return { data: apiSession, source: 'api' }
  }

  const links = getValidMockDeviceLinks()
  const matchedLink = links.find((link) => link.code === normalizedCode)

  if (matchedLink === undefined) {
    writeStorage(MOCK_DEVICE_LINKS_KEY, links)
    return null
  }

  saveStoredSession(matchedLink.session)
  writeStorage(MOCK_DEVICE_LINKS_KEY, links)

  return { data: matchedLink.session, source: 'mock' }
}

export async function listAssets(userId: string): Promise<ApiResult<Asset[]>> {
  const apiAssets = await getJson<unknown[]>(`/api/assets?user_id=${userId}`)

  if (apiAssets !== null) {
    return { data: normalizeAssets(apiAssets), source: 'api' }
  }

  return { data: getMockAssets(), source: 'mock' }
}

export async function createAsset(
  payload: CreateAssetPayload,
): Promise<ApiResult<Asset>> {
  const apiAsset = await postAssetGeneration(payload)

  if (apiAsset !== null) {
    const normalizedAsset = normalizeAsset(apiAsset)

    return {
      data: normalizedAsset ?? createPendingAssetFromPayload(payload, apiAsset),
      source: 'api',
    }
  }

  const mockInitialStatus = shouldCreateMockFailedAsset(payload) ? 'failed' : 'generating'
  const createdAsset = createClientAssetFromPayload(payload, {
    id: createClientId('asset'),
    status: mockInitialStatus,
  })

  const assets = [createdAsset, ...getMockAssets()]
  writeStorage(MOCK_ASSETS_KEY, assets)

  return { data: createdAsset, source: 'mock' }
}

export function saveMockAssets(assets: Asset[]) {
  writeStorage(MOCK_ASSETS_KEY, assets)
}

export async function listRooms(): Promise<ApiResult<RoomSummary[]>> {
  const apiRooms = await getJson<RoomSummary[]>('/api/rooms')

  if (apiRooms !== null) {
    return { data: normalizeRooms(apiRooms), source: 'api' }
  }

  return { data: getMockRooms(), source: 'mock' }
}

export async function createRoom(
  payload: CreateRoomPayload,
): Promise<ApiResult<RoomSummary>> {
  const apiRoom = await postJson<RoomSummary>('/api/rooms', {
    user_id: payload.userId,
    name: payload.name,
    is_public: payload.isPublic,
    password: payload.password ?? null,
    max_players: payload.maxPlayers,
  })

  if (apiRoom !== null) {
    return { data: normalizeRoom(apiRoom), source: 'api' }
  }

  const createdRoom: RoomSummary = {
    id: createClientId('room'),
    name: payload.name || '새 릴레이 방',
    hostId: payload.userId,
    hostNickname: 'me',
    isPublic: payload.isPublic,
    players: 1,
    maxPlayers: payload.maxPlayers,
    phase: 'lobby',
    elapsedSeconds: 0,
    phaseEndsAt: null,
  }

  const rooms = [createdRoom, ...getMockRooms()]
  writeStorage(MOCK_ROOMS_KEY, rooms)

  if (!payload.isPublic && payload.password !== undefined) {
    const passwords = getMockRoomPasswords()
    writeStorage(MOCK_ROOM_PASSWORDS_KEY, { ...passwords, [createdRoom.id]: payload.password })
  }

  return { data: createdRoom, source: 'mock' }
}

export async function joinPublicRoom(userId: string): Promise<ApiResult<RoomSummary> | null> {
  const apiRoom = await postJson<RoomSummary>('/api/rooms/public/join', { user_id: userId })

  if (apiRoom !== null) {
    return { data: normalizeRoom(apiRoom), source: 'api' }
  }

  const rooms = getMockRooms()
  const joinableRooms = rooms.filter(
    (room) =>
      room.isPublic &&
      room.phase === 'lobby' &&
      room.players < room.maxPlayers &&
      room.hostId !== userId,
  )

  if (joinableRooms.length === 0) {
    return null
  }

  const selectedRoom = selectMockPublicJoinRoom(joinableRooms)
  const joinedRoom = {
    ...selectedRoom,
    players: Math.min(selectedRoom.maxPlayers, selectedRoom.players + 1),
  }
  saveMockRooms(rooms.map((room) => (room.id === joinedRoom.id ? joinedRoom : room)))

  return { data: joinedRoom, source: 'mock' }
}

function selectMockPublicJoinRoom(joinableRooms: RoomSummary[]) {
  return joinableRooms[Math.floor(Math.random() * joinableRooms.length)]
}

export async function joinRoom(
  roomId: string,
  payload: JoinRoomPayload,
): Promise<ApiResult<RoomSummary> | null> {
  const apiRoom = await postJson<RoomSummary>(`/api/rooms/${roomId}/join`, {
    user_id: payload.userId,
    password: payload.password ?? null,
  })

  if (apiRoom !== null) {
    return { data: normalizeRoom(apiRoom), source: 'api' }
  }

  const rooms = getMockRooms()
  const targetRoom = rooms.find((room) => room.id === roomId)

  if (
    targetRoom === undefined ||
    targetRoom.phase !== 'lobby' ||
    targetRoom.players >= targetRoom.maxPlayers
  ) {
    return null
  }

  if (!targetRoom.isPublic) {
    const expectedPassword = getMockRoomPasswords()[roomId] ?? '1234'

    if ((payload.password ?? '') !== expectedPassword) {
      return null
    }
  }

  const joinedRoom = {
    ...targetRoom,
    players: Math.min(targetRoom.maxPlayers, targetRoom.players + 1),
  }
  saveMockRooms(rooms.map((room) => (room.id === joinedRoom.id ? joinedRoom : room)))

  return { data: joinedRoom, source: 'mock' }
}

export async function saveMapSegment(
  roomId: string,
  payload: CreateMapSegmentPayload,
): Promise<ApiResult<MapSegmentSnapshot>> {
  const assetRefs = makeSegmentAssetRefs(payload.placements)
  const apiSegment = await postJson<Partial<MapSegmentSnapshot>>(`/api/rooms/${roomId}/segments`, {
    user_id: payload.userId,
    start_point: payload.startPoint,
    end_point: payload.endPoint,
    assets: assetRefs.map((asset) => ({
      asset_id: asset.assetId,
      asset_category: asset.assetCategory,
      asset_attrs: asset.assetAttrs,
      collider_type: asset.colliderType,
      x: asset.x,
      y: asset.y,
      width_cells: asset.widthCells,
      height_cells: asset.heightCells,
      rotation: asset.rotation,
    })),
  })

  if (apiSegment !== null) {
    return {
      data: normalizeMapSegment(apiSegment, roomId, payload, assetRefs),
      source: 'api',
    }
  }

  const submittedAt = new Date().toISOString()
  const segment: MapSegmentSnapshot = {
    id: createClientId('segment'),
    roomId,
    creatorId: payload.userId,
    startPoint: payload.startPoint,
    endPoint: payload.endPoint,
    placements: payload.placements,
    assetRefs,
    segmentHash: makeSegmentHash(payload.startPoint, payload.endPoint, assetRefs),
    isValidated: false,
    submittedAt,
    validatedAt: null,
    clearTimeMs: null,
  }
  const segments = [
    segment,
    ...getMockMapSegments().filter(
      (storedSegment) =>
        storedSegment.roomId !== roomId || storedSegment.creatorId !== payload.userId,
    ),
  ]

  writeStorage(MOCK_MAP_SEGMENTS_KEY, segments)

  return { data: segment, source: 'mock' }
}

export async function validateMapSegment(
  roomId: string,
  segment: MapSegmentSnapshot,
  payload: ValidateMapSegmentPayload,
): Promise<ApiResult<MapSegmentSnapshot>> {
  const apiResult = await postJson<unknown>(`/api/rooms/${roomId}/segments/validate`, {
    user_id: payload.userId,
    segment_hash: payload.segmentHash,
    cleared: payload.cleared,
    clear_time_ms: payload.clearTimeMs,
  })
  const validatedSegment = {
    ...segment,
    isValidated: payload.cleared,
    clearTimeMs: payload.clearTimeMs,
    validatedAt: new Date().toISOString(),
  }

  if (apiResult !== null) {
    return { data: validatedSegment, source: 'api' }
  }

  const segments = getMockMapSegments().map((storedSegment) =>
    storedSegment.id === segment.id ? validatedSegment : storedSegment,
  )
  writeStorage(MOCK_MAP_SEGMENTS_KEY, segments)

  return { data: validatedSegment, source: 'mock' }
}

export async function mergeRoomMap(roomId: string): Promise<ApiResult<MergedMap> | null> {
  const apiMergedMap = await postJson<MergedMap>(`/api/rooms/${roomId}/merge`, {})

  if (apiMergedMap === null) {
    return null
  }

  return { data: apiMergedMap, source: 'api' }
}

async function getJson<T>(path: string) {
  if (!REMOTE_API_ENABLED) {
    return null
  }

  try {
    const response = await fetch(path)
    if (!response.ok) {
      return null
    }

    return unwrapApiResponse<T>(await response.json())
  } catch {
    return null
  }
}

async function postJson<T>(path: string, payload: unknown) {
  if (!REMOTE_API_ENABLED) {
    return null
  }

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return null
    }

    return unwrapApiResponse<T>(await response.json())
  } catch {
    return null
  }
}

async function postFormData<T>(path: string, payload: FormData) {
  if (!REMOTE_API_ENABLED) {
    return null
  }

  try {
    const response = await fetch(path, {
      method: 'POST',
      body: payload,
    })

    if (!response.ok) {
      return null
    }

    return unwrapApiResponse<T>(await response.json())
  } catch {
    return null
  }
}

async function postAssetGeneration(payload: CreateAssetPayload) {
  if (!REMOTE_API_ENABLED) {
    return null
  }

  const formData = await buildAssetGenerationFormData(payload)
  const primaryPath =
    payload.category === 'avatar' ? '/api/assets/avatar/generate' : '/api/assets/generate'
  const formResult = await postFormData<unknown>(primaryPath, formData)

  if (formResult !== null) {
    return formResult
  }

  return postJson<unknown>('/api/assets/generate', payload)
}

async function buildAssetGenerationFormData(payload: CreateAssetPayload) {
  const formData = new FormData()
  const prompt = payload.description.trim() || payload.name.trim() || '2D platformer sprite'

  formData.append('user_id', payload.userId)
  formData.append('user_prompt', prompt)
  formData.append('name', payload.name)
  formData.append('attrs', JSON.stringify(payload.attrs))
  formData.append('width_cells', String(payload.widthCells ?? ''))
  formData.append('height_cells', String(payload.heightCells ?? ''))

  if (payload.remixOfId !== null && payload.remixOfId !== undefined) {
    formData.append('remix_of_id', payload.remixOfId)
  }

  if (payload.category !== 'avatar') {
    formData.append('asset_type', toBackendAssetType(payload.category))
  }

  formData.append('image', await dataUrlToBlob(payload.image), `${payload.category}-${Date.now()}.png`)

  return formData
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  return response.blob()
}

function unwrapApiResponse<T>(payload: unknown) {
  if (!isRecord(payload) || payload.ok !== true) {
    return payload as T
  }

  const keys = [
    'data',
    'user',
    'session',
    'ticket',
    'asset',
    'assets',
    'room',
    'rooms',
    'segment',
    'mergedMap',
    'merged_map',
    'job',
  ]

  for (const key of keys) {
    if (key in payload) {
      return payload[key] as T
    }
  }

  return payload as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getMockAssets() {
  return mergeStarterAssets(readStorage<Asset[]>(MOCK_ASSETS_KEY) ?? [])
}

function mergeStarterAssets(storedAssets: Asset[]) {
  const storedIds = new Set(storedAssets.map((asset) => asset.id))

  return normalizeAssets([
    ...starterAssets.filter((asset) => !storedIds.has(asset.id)),
    ...storedAssets,
  ])
}

function getMockRooms() {
  return migrateLegacyMockRoomCapacity(
    normalizeRooms(readStorage<RoomSummary[]>(MOCK_ROOMS_KEY) ?? defaultRooms),
  )
}

function getMockMapSegments() {
  return readStorage<MapSegmentSnapshot[]>(MOCK_MAP_SEGMENTS_KEY) ?? []
}

export function saveMockRooms(rooms: RoomSummary[]) {
  writeStorage(MOCK_ROOMS_KEY, rooms)
}

function migrateLegacyMockRoomCapacity(rooms: RoomSummary[]) {
  if (readStorageText(MOCK_ROOM_CAPACITY_MIGRATION_KEY) === 'done') {
    return rooms
  }

  const migratedRooms = rooms.map((room) => {
    if (room.phase !== 'lobby' || room.maxPlayers <= 1 || room.players < room.maxPlayers) {
      return room
    }

    return { ...room, players: room.maxPlayers - 1 }
  })

  writeStorageText(MOCK_ROOM_CAPACITY_MIGRATION_KEY, 'done')

  if (migratedRooms.some((room, index) => room.players !== rooms[index]?.players)) {
    writeStorage(MOCK_ROOMS_KEY, migratedRooms)
  }

  return migratedRooms
}

function getMockRoomPasswords() {
  return readStorage<Record<string, string>>(MOCK_ROOM_PASSWORDS_KEY) ?? {}
}

function getSessionStorageKey() {
  const profileId = getSessionProfileId()

  return profileId === null ? SESSION_KEY : `${SESSION_KEY}.${profileId}`
}

function getSessionProfileId() {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return null
  }

  const searchParams = new URLSearchParams(window.location.search)
  const profileFromUrl = normalizeSessionProfileId(searchParams.get('profile'))

  if (profileFromUrl !== null) {
    try {
      sessionStorage.setItem(SESSION_PROFILE_KEY, profileFromUrl)
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
    return profileFromUrl
  }

  try {
    return normalizeSessionProfileId(sessionStorage.getItem(SESSION_PROFILE_KEY))
  } catch {
    return null
  }
}

function normalizeSessionProfileId(value: string | null) {
  if (value === null) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)

  return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizeRooms(rooms: RoomSummary[]) {
  return rooms.map((room) => normalizeRoom(room))
}

function normalizeRoom(room: RoomSummary) {
  const rawRoom = room as RoomSummary & {
    currentPlayers?: number
    host_id?: string
    hostUserId?: string
    host_user_id?: string
    ownerId?: string
    owner_id?: string
    host_nickname?: string
    is_public?: boolean
    max_players?: number
    elapsed_seconds?: number
    phase_ends_at?: string | null
  }

  return {
    id: rawRoom.id,
    name: rawRoom.name,
    hostId:
      rawRoom.hostId ??
      readString(rawRoom.host_id) ??
      readString(rawRoom.hostUserId) ??
      readString(rawRoom.host_user_id) ??
      readString(rawRoom.ownerId) ??
      readString(rawRoom.owner_id),
    hostNickname: rawRoom.hostNickname ?? rawRoom.host_nickname ?? 'host',
    isPublic: rawRoom.isPublic ?? rawRoom.is_public ?? true,
    players: rawRoom.players ?? rawRoom.currentPlayers ?? 1,
    maxPlayers: rawRoom.maxPlayers ?? rawRoom.max_players ?? 4,
    phase: normalizeRoomPhase(rawRoom.phase),
    elapsedSeconds: rawRoom.elapsedSeconds ?? rawRoom.elapsed_seconds ?? 0,
    phaseEndsAt: rawRoom.phaseEndsAt ?? rawRoom.phase_ends_at ?? null,
  }
}

function normalizeRoomPhase(phase: RoomSummary['phase'] | string | undefined): RoomSummary['phase'] {
  const normalizedPhase = String(phase ?? 'lobby').toLowerCase()

  if (normalizedPhase === 'building') {
    return 'building'
  }

  if (normalizedPhase === 'validating') {
    return 'validating'
  }

  if (normalizedPhase === 'merging') {
    return 'merging'
  }

  if (normalizedPhase === 'racing') {
    return 'racing'
  }

  if (normalizedPhase === 'finished' || normalizedPhase === 'results') {
    return 'finished'
  }

  return 'lobby'
}

function normalizeMapSegment(
  segment: Partial<MapSegmentSnapshot> & {
    room_id?: string
    creator_id?: string
    start_point?: MapPoint
    end_point?: MapPoint
    assets?: MapSegmentAssetSnapshot[]
    segment_hash?: string
    is_validated?: boolean
    submitted_at?: string
    validated_at?: string | null
    clear_time_ms?: number | null
  },
  roomId: string,
  fallbackPayload: CreateMapSegmentPayload,
  fallbackAssetRefs: MapSegmentAssetSnapshot[],
) {
  return {
    id: segment.id ?? createClientId('segment'),
    roomId: segment.roomId ?? segment.room_id ?? roomId,
    creatorId: segment.creatorId ?? segment.creator_id ?? fallbackPayload.userId,
    startPoint: segment.startPoint ?? segment.start_point ?? fallbackPayload.startPoint,
    endPoint: segment.endPoint ?? segment.end_point ?? fallbackPayload.endPoint,
    placements: segment.placements ?? fallbackPayload.placements,
    assetRefs: normalizeSegmentAssetRefs(segment.assetRefs ?? segment.assets, fallbackAssetRefs),
    segmentHash:
      segment.segmentHash ??
      segment.segment_hash ??
      makeSegmentHash(fallbackPayload.startPoint, fallbackPayload.endPoint, fallbackAssetRefs),
    isValidated: segment.isValidated ?? segment.is_validated ?? false,
    submittedAt: segment.submittedAt ?? segment.submitted_at ?? new Date().toISOString(),
    validatedAt: segment.validatedAt ?? segment.validated_at ?? null,
    clearTimeMs: segment.clearTimeMs ?? segment.clear_time_ms ?? null,
  }
}

function makeSegmentAssetRefs(placements: MapPlacement[]) {
  return placements
    .map((placement) => ({
      assetId: placement.asset.id,
      assetCategory: placement.asset.category,
      assetAttrs: placement.asset.attrs,
      colliderType: placement.asset.colliderType,
      x: placement.x,
      y: placement.y,
      widthCells: placement.asset.widthCells ?? 1,
      heightCells: placement.asset.heightCells ?? 1,
      rotation: 0,
    }))
    .sort((left, right) => {
      if (left.y !== right.y) {
        return left.y - right.y
      }

      if (left.x !== right.x) {
        return left.x - right.x
      }

      return left.assetId.localeCompare(right.assetId)
    })
}

function normalizeSegmentAssetRefs(
  assetRefs:
    | (Partial<MapSegmentAssetSnapshot> & {
        asset_id?: string
        asset_category?: MapSegmentAssetSnapshot['assetCategory']
        asset_attrs?: MapSegmentAssetSnapshot['assetAttrs']
        collider_type?: MapSegmentAssetSnapshot['colliderType']
        width_cells?: number
        height_cells?: number
      })[]
    | undefined,
  fallbackAssetRefs: MapSegmentAssetSnapshot[],
) {
  if (assetRefs === undefined) {
    return fallbackAssetRefs
  }

  return assetRefs.map((asset, index) => ({
    assetId: asset.assetId ?? asset.asset_id ?? fallbackAssetRefs[index]?.assetId ?? 'unknown-asset',
    assetCategory:
      asset.assetCategory ?? asset.asset_category ?? fallbackAssetRefs[index]?.assetCategory,
    assetAttrs: asset.assetAttrs ?? asset.asset_attrs ?? fallbackAssetRefs[index]?.assetAttrs,
    colliderType:
      asset.colliderType ?? asset.collider_type ?? fallbackAssetRefs[index]?.colliderType,
    x: asset.x ?? fallbackAssetRefs[index]?.x ?? 0,
    y: asset.y ?? fallbackAssetRefs[index]?.y ?? 0,
    widthCells: asset.widthCells ?? asset.width_cells ?? fallbackAssetRefs[index]?.widthCells ?? 1,
    heightCells:
      asset.heightCells ?? asset.height_cells ?? fallbackAssetRefs[index]?.heightCells ?? 1,
    rotation: asset.rotation ?? fallbackAssetRefs[index]?.rotation ?? 0,
  }))
}

function makeSegmentHash(
  startPoint: MapPoint,
  endPoint: MapPoint,
  assetRefs: MapSegmentAssetSnapshot[],
) {
  return `mock-${hashString(JSON.stringify({ startPoint, endPoint, assetRefs }))}`
}

function hashString(value: string) {
  let hash = 5381

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function getValidMockDeviceLinks() {
  const now = Date.now()
  return (readStorage<StoredDeviceLink[]>(MOCK_DEVICE_LINKS_KEY) ?? []).filter(
    (link) => new Date(link.expiresAt).getTime() > now,
  )
}

function makeDeviceLinkCode() {
  const words = ['TIGER', 'RAMP', 'PIXEL', 'RELAY', 'BLOCK', 'JUMP']
  const existingCodes = new Set(getValidMockDeviceLinks().map((link) => link.code))

  for (let index = 0; index < 20; index += 1) {
    const word = words[Math.floor(Math.random() * words.length)]
    const number = Math.floor(1000 + Math.random() * 9000)
    const code = `${word}-${number}`

    if (!existingCodes.has(code)) {
      return code
    }
  }

  return `RELAY-${Math.floor(1000 + Math.random() * 9000)}`
}

function normalizeDeviceLinkCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '-')
}

function getSpriteJobs(
  category: Asset['category'],
  status: Asset['status'] = 'queued',
  sheetUrl: string | null = null,
) {
  if (category === 'avatar' || category === 'monster') {
    return [
      {
        action: 'idle' as const,
        status,
        sheetUrl: status === 'ready' ? sheetUrl : null,
        frameCount: status === 'ready' ? 8 : null,
        lastRegenAt: null,
      },
      {
        action: 'walk' as const,
        status,
        sheetUrl: status === 'ready' ? sheetUrl : null,
        frameCount: status === 'ready' ? 8 : null,
        lastRegenAt: null,
      },
      {
        action: 'onair' as const,
        status,
        sheetUrl: status === 'ready' ? sheetUrl : null,
        frameCount: status === 'ready' ? 8 : null,
        lastRegenAt: null,
      },
    ]
  }

  return [
    {
      action: 'static' as const,
      status,
      sheetUrl: status === 'ready' ? sheetUrl : null,
      frameCount: status === 'ready' ? 1 : null,
      lastRegenAt: null,
    },
  ]
}

function inferColliderType(
  category: CreateAssetPayload['category'],
  attrs: CreateAssetPayload['attrs'],
): Asset['colliderType'] {
  if (category === 'background') {
    return 'none'
  }

  if (
    category === 'platform' &&
    typeof attrs.shape === 'string' &&
    attrs.shape.startsWith('slope-')
  ) {
    return 'slope'
  }

  return 'rect'
}

function readStorage<T>(key: string) {
  const rawValue = readStorageText(key)

  if (rawValue === null) {
    return null
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    removeStorageItem(key)
    return null
  }
}

function readStorageText(key: string) {
  if (typeof localStorage === 'undefined') {
    return null
  }

  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown) {
  return writeStorageText(key, JSON.stringify(value))
}

function writeStorageText(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeStorageItem(key: string) {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function normalizeAssets(assets: unknown[]) {
  return assets
    .map((asset) => normalizeAsset(asset))
    .filter((asset): asset is Asset => asset !== null)
}

function normalizeAsset(asset: unknown): Asset | null {
  if (!isRecord(asset)) {
    return null
  }

  const category = normalizeAssetCategory(asset.category ?? asset.type)
  const attrs = normalizeAssetAttrs(asset.attrs)
  const status = normalizeAssetStatus(asset.status)
  const sourceImageUrl =
    readString(asset.sourceImageUrl) ??
    readString(asset.source_image_url) ??
    readString(asset.spriteUrl) ??
    readString(asset.sprite_url) ??
    ''
  const creatorId =
    readString(asset.creatorId) ?? readString(asset.ownerId) ?? readString(asset.owner_id)
  const hasOwnerField = 'ownerId' in asset || 'owner_id' in asset

  return {
    id: readString(asset.id) ?? createClientId('asset'),
    creatorId,
    isSystem:
      asset.isSystem === true ||
      asset.is_system === true ||
      (hasOwnerField && creatorId === null),
    category,
    name: readString(asset.name) ?? defaultAssetName(category),
    description: readString(asset.description) ?? '',
    attrs,
    colliderType: normalizeColliderType(asset.colliderType ?? asset.collider_type, category, attrs),
    widthCells: readNullableNumber(asset.widthCells ?? asset.width_cells),
    heightCells: readNullableNumber(asset.heightCells ?? asset.height_cells),
    sourceImageUrl,
    remixOfId: readString(asset.remixOfId) ?? readString(asset.remix_of_id),
    status,
    isPublic: asset.isPublic === true || asset.is_public === true,
    createdAt:
      readString(asset.createdAt) ?? readString(asset.created_at) ?? new Date().toISOString(),
    sprites: normalizeAssetSprites(asset.sprites, category, sourceImageUrl, status),
  }
}

function createPendingAssetFromPayload(payload: CreateAssetPayload, apiResult: unknown) {
  const value = isRecord(apiResult) ? apiResult : {}
  const jobId = readString(value.id) ?? readString(value.jobId) ?? readString(value.job_id)
  const outputAssetId = readString(value.outputAssetId) ?? readString(value.output_asset_id)
  const status = normalizeAssetStatus(value.status)

  return createClientAssetFromPayload(payload, {
    id: outputAssetId ?? (jobId === null ? createClientId('asset') : `job-${jobId}`),
    status,
    extraAttrs: jobId === null ? {} : { generationJobId: jobId },
  })
}

function createClientAssetFromPayload(
  payload: CreateAssetPayload,
  options: {
    id: string
    status: Asset['status']
    extraAttrs?: Asset['attrs']
  },
): Asset {
  return {
    id: options.id,
    creatorId: payload.userId,
    isSystem: false,
    category: payload.category,
    name: payload.name,
    description: payload.description,
    attrs: { ...payload.attrs, ...options.extraAttrs },
    colliderType: inferColliderType(payload.category, payload.attrs),
    widthCells: payload.widthCells,
    heightCells: payload.heightCells,
    sourceImageUrl: payload.image,
    remixOfId: payload.remixOfId ?? null,
    status: options.status,
    isPublic: true,
    createdAt: new Date().toISOString(),
    sprites: getSpriteJobs(
      payload.category,
      options.status,
      options.status === 'ready' ? payload.image : null,
    ),
  }
}

function shouldCreateMockFailedAsset(payload: CreateAssetPayload) {
  const testText = `${payload.name} ${payload.description}`.toLowerCase()

  return testText.includes('mock-fail') || testText.includes('실패테스트')
}

function normalizeAssetAttrs(attrs: unknown): Asset['attrs'] {
  if (!isRecord(attrs)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(attrs).filter(
      (entry): entry is [string, string | number | boolean | null] =>
        typeof entry[1] === 'string' ||
        typeof entry[1] === 'number' ||
        typeof entry[1] === 'boolean' ||
        entry[1] === null,
    ),
  )
}

function normalizeAssetSprites(
  sprites: unknown,
  category: Asset['category'],
  sourceImageUrl: string,
  fallbackStatus: Asset['status'],
) {
  if (!Array.isArray(sprites)) {
    return getSpriteJobs(category, fallbackStatus, sourceImageUrl || null)
  }

  const normalizedSprites = sprites
    .map((sprite) => {
      if (!isRecord(sprite)) {
        return null
      }

      const status = normalizeAssetStatus(sprite.status)

      return {
        action: normalizeSpriteAction(sprite.action),
        status,
        sheetUrl:
          readString(sprite.sheetUrl) ??
          readString(sprite.sheet_url) ??
          (status === 'ready' ? sourceImageUrl || null : null),
        frameCount: readNullableNumber(sprite.frameCount ?? sprite.frame_count),
        lastRegenAt: readString(sprite.lastRegenAt) ?? readString(sprite.last_regen_at),
      }
    })
    .filter((sprite): sprite is Asset['sprites'][number] => sprite !== null)

  return normalizedSprites.length > 0
    ? normalizedSprites
    : getSpriteJobs(category, fallbackStatus, sourceImageUrl || null)
}

function normalizeSpriteAction(action: unknown): Asset['sprites'][number]['action'] {
  const normalized = String(action ?? '').toLowerCase()

  if (normalized === 'walk') {
    return 'walk'
  }

  if (normalized === 'onair' || normalized === 'air' || normalized === 'jump') {
    return 'onair'
  }

  if (normalized === 'static') {
    return 'static'
  }

  return 'idle'
}

function normalizeAssetStatus(status: unknown): Asset['status'] {
  const normalized = String(status ?? '').toLowerCase()

  if (normalized.includes('fail') || normalized.includes('error')) {
    return 'failed'
  }

  if (normalized.includes('ready') || normalized.includes('done') || normalized.includes('complete')) {
    return 'ready'
  }

  if (normalized.includes('generat') || normalized.includes('running') || normalized.includes('sprite')) {
    return 'generating'
  }

  return 'queued'
}

function normalizeAssetCategory(category: unknown): Asset['category'] {
  const normalized = String(category ?? '').toLowerCase()

  if (normalized === 'avatar') {
    return 'avatar'
  }

  if (normalized === 'terrain' || normalized === 'platform') {
    return 'platform'
  }

  if (normalized === 'enemy' || normalized === 'monster') {
    return 'monster'
  }

  if (normalized === 'item') {
    return 'item'
  }

  if (normalized === 'background') {
    return 'background'
  }

  return 'obstacle'
}

function normalizeColliderType(
  colliderType: unknown,
  category: Asset['category'],
  attrs: Asset['attrs'],
): Asset['colliderType'] {
  const normalized = String(colliderType ?? '').toLowerCase()

  if (normalized.includes('none') || normalized.includes('decorative')) {
    return 'none'
  }

  if (normalized.includes('slope')) {
    return 'slope'
  }

  if (category === 'background') {
    return 'none'
  }

  if (typeof attrs.shape === 'string' && attrs.shape.startsWith('slope-')) {
    return 'slope'
  }

  return 'rect'
}

function toBackendAssetType(category: Asset['category']) {
  if (category === 'platform') {
    return 'TERRAIN'
  }

  if (category === 'monster') {
    return 'ENEMY'
  }

  if (category === 'item') {
    return 'ITEM'
  }

  if (category === 'background') {
    return 'BACKGROUND'
  }

  return 'DEVICE'
}

function defaultAssetName(category: Asset['category']) {
  if (category === 'avatar') {
    return '아바타'
  }

  return `${category} asset`
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
