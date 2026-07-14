import type {
  WarehouseAssetViewModel,
  WarehouseFilter,
  WarehouseReviewAction,
  WarehouseScreenCallbacks,
  WarehouseScreenProps,
  WarehouseScreenState,
  WarehouseTab,
} from '../../pages/warehouse/WarehouseScreen'

export type WarehouseFixtureViewport = '1280x720' | '1440x900' | '1920x1080'

export interface WarehouseScreenFixture {
  id: string
  screenId: 'S2B_WAREHOUSE'
  title: string
  description: string
  state: WarehouseScreenState
  viewport: WarehouseFixtureViewport
  selectedTab: WarehouseTab
  selectedFilter: WarehouseFilter
  assets: WarehouseAssetViewModel[]
  selectedAssetId?: string
  selectedAction?: WarehouseReviewAction
  connectionStatus?: WarehouseScreenProps['connectionStatus']
  connectionMessage?: string
  refreshing?: boolean
}

const readyAvatar: WarehouseAssetViewModel = {
  id: 'asset-avatar-runner',
  name: '노란 러너',
  description: '기본 아바타 대신 장착할 수 있는 사용자 아바타입니다.',
  category: 'avatar',
  status: 'ready',
  statusText: '사용 가능',
  isEquipped: true,
  createdAtText: '오늘',
  sizeText: '256x512',
  actions: [
    { id: 'idle', label: '대기', status: 'available' },
    { id: 'walk', label: '걷기', status: 'available' },
    { id: 'onair', label: '공중', status: 'available' },
  ],
}

const cooldownAvatar: WarehouseAssetViewModel = {
  ...readyAvatar,
  id: 'asset-avatar-cooldown',
  isEquipped: false,
  actions: [
    { id: 'idle', label: '대기', status: 'cooling_down', cooldownText: '04:12' },
    { id: 'walk', label: '걷기', status: 'available' },
    { id: 'onair', label: '공중', status: 'available' },
  ],
}

const queuedPlatform: WarehouseAssetViewModel = {
  id: 'asset-platform-queued',
  name: '구름 발판',
  description: '릴레이 맵에서 점프 간격을 조절하는 플랫폼입니다.',
  category: 'platform',
  status: 'queued',
  statusText: '대기 중',
  estimateText: '대기 중 · 예상 2~4분',
  createdAtText: '방금 전',
  sizeText: '2x1',
  actions: [{ id: 'static', label: '정적', status: 'disabled', disabledReason: '생성 대기 중입니다.' }],
}

const generatingObstacle: WarehouseAssetViewModel = {
  id: 'asset-obstacle-generating',
  name: '회전 장애물',
  description: '검증 단계에서 피해야 하는 장애물 에셋입니다.',
  category: 'obstacle',
  status: 'generating',
  statusText: '생성 중',
  estimateText: '생성 중 · 남은 시간 약 3분',
  progress: 48,
  createdAtText: '1분 전',
  sizeText: '1x2',
  actions: [{ id: 'static', label: '정적', status: 'working', progress: 48 }],
}

const readyPlatform: WarehouseAssetViewModel = {
  id: 'asset-platform-ready',
  name: '튼튼한 발판 세로점프 연결용 긴 이름',
  description: '가장 기본적인 지형 컴포넌트이며 긴 이름과 설명이 카드 안에서 줄바꿈되는지 확인합니다.',
  category: 'platform',
  status: 'ready',
  statusText: '사용 가능',
  createdAtText: '어제',
  sizeText: '3x1',
  actions: [{ id: 'static', label: '정적', status: 'available' }],
}

const readyMonster: WarehouseAssetViewModel = {
  id: 'asset-monster-ready',
  name: '경비 드론',
  description: '일정 구간을 순찰하는 몬스터 에셋입니다.',
  category: 'monster',
  status: 'ready',
  statusText: '사용 가능',
  createdAtText: '2일 전',
  sizeText: '1x1',
  actions: [{ id: 'static', label: '정적', status: 'available' }],
}

const readyBackground: WarehouseAssetViewModel = {
  id: 'asset-background-ready',
  name: '노을 배경',
  description: '릴레이 레이스 뒤쪽에 배치할 수 있는 배경 에셋입니다.',
  category: 'background',
  status: 'ready',
  statusText: '사용 가능',
  createdAtText: '3일 전',
  sizeText: '8x5',
  actions: [],
}

const failedObstacle: WarehouseAssetViewModel = {
  id: 'asset-obstacle-failed',
  name: '붉은 게이트',
  description: '생성 작업이 실패해서 다시 시도할 수 있습니다.',
  category: 'obstacle',
  status: 'failed',
  statusText: '생성 실패',
  errorText: '에셋 생성에 실패했어요. 다시 시도할 수 있어요.',
  createdAtText: '5분 전',
  sizeText: '2x2',
  actions: [{ id: 'static', label: '정적', status: 'available' }],
}

const malformedAsset: WarehouseAssetViewModel = {
  id: 'asset-malformed',
  name: '형식 오류 에셋',
  description: '필수 크기 정보가 없어 사용할 수 없습니다.',
  category: 'platform',
  status: 'malformed',
  statusText: '형식 오류',
  errorText: '서버 응답 형식이 올바르지 않아요.',
  createdAtText: '알 수 없음',
  actions: [{ id: 'static', label: '정적', status: 'disabled', disabledReason: '형식 오류를 해결해야 합니다.' }],
}

const mixedAssets = [
  readyAvatar,
  queuedPlatform,
  generatingObstacle,
  readyPlatform,
  readyMonster,
  readyBackground,
  failedObstacle,
]

export const warehouseScreenFixtures: WarehouseScreenFixture[] = [
  createWarehouseFixture({
    id: 's2b-warehouse-loading',
    title: '창고 로딩',
    description: '에셋 목록을 불러오는 동안 layout height를 유지합니다.',
    state: 'loading',
    selectedTab: 'component',
    assets: [],
    viewport: '1280x720',
    refreshing: true,
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-avatar-empty',
    title: '창고 아바타 없음',
    description: '사용자가 만든 아바타가 없는 상태입니다.',
    state: 'avatarEmpty',
    selectedTab: 'avatar',
    assets: [],
    viewport: '1280x720',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-component-empty',
    title: '창고 컴포넌트 없음',
    description: '컴포넌트 탭에서 표시할 사용자 제작 에셋이 없는 상태입니다.',
    state: 'componentEmpty',
    selectedTab: 'component',
    assets: [],
    viewport: '1280x720',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-queued',
    title: '창고 대기 중',
    description: 'queued 상태와 예상 시간을 표시합니다.',
    state: 'queued',
    selectedTab: 'component',
    assets: [queuedPlatform],
    viewport: '1440x900',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-generating',
    title: '창고 생성 중',
    description: 'generating 상태와 진행률을 표시합니다.',
    state: 'generating',
    selectedTab: 'component',
    selectedFilter: 'obstacle',
    assets: [generatingObstacle],
    viewport: '1440x900',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-ready',
    title: '창고 사용 가능',
    description: 'ready 아바타와 장착 상태를 표시합니다.',
    state: 'ready',
    selectedTab: 'avatar',
    assets: [readyAvatar],
    viewport: '1440x900',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-failed',
    title: '창고 생성 실패',
    description: 'failed 카드와 다시 시도 affordance를 표시합니다.',
    state: 'failed',
    selectedTab: 'component',
    selectedFilter: 'obstacle',
    assets: [failedObstacle],
    viewport: '1440x900',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-mixed',
    title: '창고 혼합 상태',
    description: 'queued, generating, ready, failed 카드를 4열 grid에서 확인합니다.',
    state: 'mixed',
    selectedTab: 'component',
    assets: mixedAssets,
    viewport: '1440x900',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-details',
    title: '창고 상세 모달',
    description: 'AssetReviewModal이 열린 상태입니다.',
    state: 'details',
    selectedTab: 'avatar',
    assets: [readyAvatar, readyPlatform],
    selectedAssetId: readyAvatar.id,
    selectedAction: 'idle',
    viewport: '1440x900',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-cooldown',
    title: '창고 재생성 쿨다운',
    description: '액션별 재생성 버튼의 5분 쿨다운 상태입니다.',
    state: 'cooldown',
    selectedTab: 'avatar',
    assets: [cooldownAvatar],
    selectedAssetId: cooldownAvatar.id,
    selectedAction: 'idle',
    viewport: '1440x900',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-offline',
    title: '창고 오프라인',
    description: 'remote 기능이 비활성화된 offline 상태입니다.',
    state: 'offline',
    selectedTab: 'component',
    assets: mixedAssets,
    connectionStatus: 'offline',
    connectionMessage: '네트워크에 연결되지 않았어요. 원격 기능을 사용할 수 없어요.',
    viewport: '1440x900',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-reconnecting',
    title: '창고 재연결 중',
    description: 'asset job push 상태가 잠시 최신이 아닐 수 있는 상태입니다.',
    state: 'reconnecting',
    selectedTab: 'component',
    assets: mixedAssets,
    connectionStatus: 'reconnecting',
    connectionMessage: '서버와 다시 연결하고 있어요. 잠시만 기다려주세요.',
    viewport: '1920x1080',
  }),
  createWarehouseFixture({
    id: 's2b-warehouse-malformed-data',
    title: '창고 응답 형식 오류',
    description: 'malformed asset을 비활성화하고 오류 상태를 표시합니다.',
    state: 'malformedData',
    selectedTab: 'component',
    assets: [malformedAsset, readyPlatform],
    connectionStatus: 'malformed_response',
    connectionMessage: '서버 응답 형식이 올바르지 않아요.',
    viewport: '1280x720',
  }),
]

export type WarehouseScreenFixtureId = (typeof warehouseScreenFixtures)[number]['id']

export function getWarehouseScreenFixture(fixtureId: string | undefined) {
  return warehouseScreenFixtures.find((fixture) => fixture.id === fixtureId) ?? warehouseScreenFixtures[0]
}

export function getWarehouseScreenFixtureForRoute(
  tab: WarehouseTab,
  filter: WarehouseFilter | undefined,
) {
  const baseFixture = tab === 'avatar'
    ? getWarehouseScreenFixture('s2b-warehouse-ready')
    : getWarehouseScreenFixture('s2b-warehouse-mixed')

  return {
    ...baseFixture,
    selectedTab: tab,
    selectedFilter: tab === 'component' ? filter ?? 'all' : 'all',
  }
}

export function toWarehouseScreenProps(
  fixture: WarehouseScreenFixture,
  callbacks: WarehouseScreenCallbacks = createNoopWarehouseScreenCallbacks(),
): WarehouseScreenProps {
  return {
    state: fixture.state,
    selectedTab: fixture.selectedTab,
    selectedFilter: fixture.selectedFilter,
    assets: fixture.assets,
    selectedAssetId: fixture.selectedAssetId,
    selectedAction: fixture.selectedAction,
    connectionStatus: fixture.connectionStatus,
    connectionMessage: fixture.connectionMessage,
    refreshing: fixture.refreshing,
    ...callbacks,
  }
}

export function createNoopWarehouseScreenCallbacks(): WarehouseScreenCallbacks {
  return {
    onGoMain: () => undefined,
    onChangeTab: () => undefined,
    onChangeFilter: () => undefined,
    onOpenAsset: () => undefined,
    onCloseDetails: () => undefined,
    onSelectReviewAction: () => undefined,
    onEquipAvatar: () => undefined,
    onRetryAsset: () => undefined,
    onRegenerateAction: () => undefined,
    onEditAsset: () => undefined,
    onCreateAvatar: () => undefined,
    onCreateComponent: () => undefined,
    onRefresh: () => undefined,
  }
}

type WarehouseFixtureInput = Omit<
  WarehouseScreenFixture,
  'screenId' | 'selectedFilter' | 'connectionStatus' | 'refreshing'
> & {
  selectedFilter?: WarehouseFilter
  connectionStatus?: WarehouseScreenProps['connectionStatus']
  refreshing?: boolean
}

function createWarehouseFixture(input: WarehouseFixtureInput): WarehouseScreenFixture {
  return {
    screenId: 'S2B_WAREHOUSE',
    selectedFilter: 'all',
    connectionStatus: 'online',
    refreshing: false,
    ...input,
  }
}
