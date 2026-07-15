import type { LoginDataMode, LoginSession, StoragePort } from '../login/loginControllerCore'
import type {
  WarehouseAssetAction,
  WarehouseAssetCategory,
  WarehouseAiTraceStep,
  WarehouseAssetStatus,
  WarehouseAssetViewModel,
  WarehouseFilter,
  WarehouseReviewAction,
  WarehouseScreenCallbacks,
  WarehouseScreenProps,
  WarehouseScreenState,
  WarehouseTab,
} from './WarehouseScreen'

export const WAREHOUSE_REGEN_COOLDOWN_MS = 5 * 60 * 1000

export type WarehouseConnectionStatus =
  | 'online'
  | 'authentication'
  | 'offline'
  | 'reconnecting'
  | 'server_unavailable'
  | 'malformed_response'

export interface WarehouseControllerError {
  kind:
    | 'validation'
    | 'authentication'
    | 'not_found'
    | 'rate_limit'
    | 'asset_job_failure'
    | 'offline'
    | 'reconnecting'
    | 'server_unavailable'
    | 'malformed_response'
  message: string
  retryable: boolean
}

export type WarehouseResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: WarehouseControllerError
    }

export interface WarehouseAssetSpriteRecord {
  action: WarehouseReviewAction
  status: 'queued' | 'generating' | 'ready' | 'failed'
  lastRegenAt?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  aiTrace?: WarehouseAiTraceStep[]
}

export interface WarehouseAssetRecord {
  id: string
  creatorId: string | null
  isSystem: boolean
  category: WarehouseAssetCategory | 'item'
  name: string
  description: string
  sourceImageUrl: string
  status: 'queued' | 'generating' | 'ready' | 'failed'
  createdAt: string
  widthCells: number | null
  heightCells: number | null
  sprites: WarehouseAssetSpriteRecord[]
  errorCode?: string | null
  errorMessage?: string | null
  aiTrace?: WarehouseAiTraceStep[]
}

export interface WarehouseAssetPort {
  listAssets(
    session: LoginSession,
    dataMode: LoginDataMode,
  ): Promise<WarehouseResult<WarehouseAssetRecord[]>>
  equipAvatar(
    session: LoginSession,
    assetId: string,
    dataMode: LoginDataMode,
  ): Promise<WarehouseResult<LoginSession>>
  retryAsset(
    session: LoginSession,
    assetId: string,
    dataMode: LoginDataMode,
  ): Promise<WarehouseResult<WarehouseAssetRecord>>
  regenerateAction(
    session: LoginSession,
    assetId: string,
    action: WarehouseReviewAction,
    dataMode: LoginDataMode,
  ): Promise<WarehouseResult<WarehouseAssetRecord>>
}

export interface AssetJobUpdateEvent {
  assetId: string
  status: 'queued' | 'generating' | 'ready' | 'failed'
  action?: WarehouseReviewAction
  errorCode?: string
  errorMessage?: string
  aiTrace?: WarehouseAiTraceStep[]
  updatedAtMs?: number
}

export interface AssetJobConnectionEvent {
  status: WarehouseConnectionStatus
  message?: string
}

export interface AssetJobUpdates {
  getConnectionStatus(): AssetJobConnectionEvent
  subscribe(
    listener: (event: AssetJobUpdateEvent | AssetJobConnectionEvent) => void,
  ): () => void
}

export interface WarehouseRoutePort {
  navigateLogin(): void
  navigateMain(): void
  navigateWarehouse(tab: WarehouseTab, filter?: WarehouseFilter): void
  navigateAvatarStudio(assetId?: string): void
  navigateAssetStudio(assetId?: string): void
}

export interface WarehouseControllerState {
  session: LoginSession | null
  assets: WarehouseAssetRecord[]
  selectedTab: WarehouseTab
  selectedFilter: WarehouseFilter
  selectedAssetId?: string
  selectedAction?: WarehouseReviewAction
  connectionStatus: WarehouseConnectionStatus
  connectionMessage?: string
  refreshing: boolean
  nowMs: number
  loadAttempted: boolean
}

export interface WarehouseControllerRuntime {
  dataMode: LoginDataMode
  sessionStoragePort: StoragePort
  assetPort: WarehouseAssetPort
  assetJobUpdates: AssetJobUpdates
  routePort: WarehouseRoutePort
  getNowMs: () => number
  getState: () => WarehouseControllerState
  setState: (updater: (state: WarehouseControllerState) => WarehouseControllerState) => void
}

export function createInitialWarehouseControllerState(
  selectedTab: WarehouseTab = 'component',
  selectedFilter: WarehouseFilter = 'all',
  nowMs = Date.now(),
): WarehouseControllerState {
  return {
    session: null,
    assets: [],
    selectedTab,
    selectedFilter: selectedTab === 'component' ? selectedFilter : 'all',
    selectedAssetId: undefined,
    selectedAction: undefined,
    connectionStatus: 'online',
    connectionMessage: undefined,
    refreshing: false,
    nowMs,
    loadAttempted: false,
  }
}

export async function bootWarehouseController(runtime: WarehouseControllerRuntime) {
  const session = runtime.sessionStoragePort.loadSession()
  const connection = runtime.assetJobUpdates.getConnectionStatus()

  runtime.setState((state) => ({
    ...state,
    session,
    connectionStatus: connection.status,
    connectionMessage: connection.message,
  }))

  if (!session) {
    runtime.routePort.navigateLogin()
    return { destination: 'login' as const, reason: 'no_session' as const }
  }

  const result = await loadWarehouseAssets(runtime)

  return result.ok
    ? { destination: 'warehouse' as const, reason: 'loaded' as const }
    : { destination: 'warehouse' as const, reason: result.reason }
}

export async function loadWarehouseAssets(runtime: WarehouseControllerRuntime) {
  const state = runtime.getState()
  const session = state.session ?? runtime.sessionStoragePort.loadSession()

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  runtime.setState((current) => ({
    ...current,
    session,
    refreshing: true,
    loadAttempted: true,
    nowMs: runtime.getNowMs(),
  }))

  const result = await runtime.assetPort.listAssets(session, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      refreshing: false,
      connectionStatus: mapErrorToConnectionStatus(result.error),
      connectionMessage: result.error.message,
    }))

    return { ok: false as const, reason: result.error.kind }
  }

  runtime.setState((current) => ({
    ...current,
    refreshing: false,
    assets: result.value,
    connectionStatus: 'online',
    connectionMessage: undefined,
    selectedAssetId: current.selectedAssetId && hasAsset(result.value, current.selectedAssetId)
      ? current.selectedAssetId
      : undefined,
  }))

  return { ok: true as const, assets: result.value }
}

export function createWarehouseScreenProps(runtime: WarehouseControllerRuntime): WarehouseScreenProps {
  const state = runtime.getState()
  const viewModels = mapWarehouseAssetsToViewModels(state.assets, state.session, state.nowMs)

  return {
    state: deriveWarehouseScreenState(state, viewModels),
    selectedTab: state.selectedTab,
    selectedFilter: state.selectedFilter,
    assets: viewModels,
    selectedAssetId: state.selectedAssetId,
    selectedAction: state.selectedAction,
    connectionStatus: state.connectionStatus,
    connectionMessage: state.connectionMessage,
    refreshing: state.refreshing,
    ...createWarehouseScreenCallbacks(runtime),
  }
}

export function createWarehouseScreenCallbacks(
  runtime: WarehouseControllerRuntime,
): WarehouseScreenCallbacks {
  return {
    onGoLogin: () => {
      runtime.sessionStoragePort.clearSession()
      runtime.routePort.navigateLogin()
    },
    onGoMain: () => runtime.routePort.navigateMain(),
    onChangeTab: (tab) => changeWarehouseTab(runtime, tab),
    onChangeFilter: (filter) => changeWarehouseFilter(runtime, filter),
    onOpenAsset: (assetId) => openWarehouseDetails(runtime, assetId),
    onCloseDetails: () => closeWarehouseDetails(runtime),
    onSelectReviewAction: (_assetId, action) => selectWarehouseReviewAction(runtime, action),
    onEquipAvatar: (assetId) => {
      void equipWarehouseAvatar(runtime, assetId)
    },
    onRetryAsset: (assetId) => {
      void retryWarehouseAsset(runtime, assetId)
    },
    onRegenerateAction: (assetId, action) => {
      void regenerateWarehouseAction(runtime, assetId, action)
    },
    onEditAsset: (assetId) => editWarehouseAssetSource(runtime, assetId),
    onCreateAvatar: () => runtime.routePort.navigateAvatarStudio(),
    onCreateComponent: () => runtime.routePort.navigateAssetStudio(),
    onRefresh: () => {
      void loadWarehouseAssets(runtime)
    },
  }
}

export function changeWarehouseTab(runtime: WarehouseControllerRuntime, tab: WarehouseTab) {
  const currentFilter = runtime.getState().selectedFilter
  const nextFilter = tab === 'component' ? currentFilter : 'all'

  runtime.setState((state) => ({
    ...state,
    selectedTab: tab,
    selectedFilter: nextFilter,
    selectedAssetId: undefined,
    selectedAction: undefined,
  }))
  runtime.routePort.navigateWarehouse(tab, tab === 'component' ? nextFilter : undefined)
}

export function changeWarehouseFilter(
  runtime: WarehouseControllerRuntime,
  filter: WarehouseFilter,
) {
  runtime.setState((state) => ({
    ...state,
    selectedTab: 'component',
    selectedFilter: filter,
    selectedAssetId: undefined,
    selectedAction: undefined,
  }))
  runtime.routePort.navigateWarehouse('component', filter)
}

export function updateWarehouseRouteSelection(
  runtime: WarehouseControllerRuntime,
  tab: WarehouseTab,
  filter: WarehouseFilter = 'all',
) {
  runtime.setState((state) => ({
    ...state,
    selectedTab: tab,
    selectedFilter: tab === 'component' ? filter : 'all',
  }))
}

export function openWarehouseDetails(runtime: WarehouseControllerRuntime, assetId: string) {
  const asset = runtime.getState().assets.find((item) => item.id === assetId)

  runtime.setState((state) => ({
    ...state,
    selectedAssetId: assetId,
    selectedAction: getDefaultAction(asset),
    nowMs: runtime.getNowMs(),
  }))
}

export function closeWarehouseDetails(runtime: WarehouseControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    selectedAssetId: undefined,
    selectedAction: undefined,
  }))
}

export function selectWarehouseReviewAction(
  runtime: WarehouseControllerRuntime,
  action: WarehouseReviewAction,
) {
  runtime.setState((state) => ({
    ...state,
    selectedAction: action,
    nowMs: runtime.getNowMs(),
  }))
}

export async function equipWarehouseAvatar(runtime: WarehouseControllerRuntime, assetId: string) {
  const state = runtime.getState()
  const session = state.session
  const asset = state.assets.find((item) => item.id === assetId)

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  if (!asset || asset.category !== 'avatar' || asset.status !== 'ready') {
    return { ok: false as const, reason: 'not_ready' as const }
  }

  const result = await runtime.assetPort.equipAvatar(session, assetId, runtime.dataMode)

  if (!result.ok) {
    setWarehouseError(runtime, result.error)
    return { ok: false as const, reason: result.error.kind }
  }

  runtime.sessionStoragePort.saveSession(result.value)
  runtime.setState((current) => ({
    ...current,
    session: result.value,
    connectionStatus: 'online',
    connectionMessage: undefined,
  }))

  return { ok: true as const, session: result.value }
}

export async function retryWarehouseAsset(runtime: WarehouseControllerRuntime, assetId: string) {
  const state = runtime.getState()
  const session = state.session
  const asset = state.assets.find((item) => item.id === assetId)

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  if (!asset || asset.status !== 'failed') {
    return { ok: false as const, reason: 'not_failed' as const }
  }

  const result = await runtime.assetPort.retryAsset(session, assetId, runtime.dataMode)

  if (!result.ok) {
    setWarehouseError(runtime, result.error)
    return { ok: false as const, reason: result.error.kind }
  }

  mergeWarehouseAsset(runtime, result.value)

  return { ok: true as const, asset: result.value }
}

export async function regenerateWarehouseAction(
  runtime: WarehouseControllerRuntime,
  assetId: string,
  action: WarehouseReviewAction,
) {
  const state = runtime.getState()
  const session = state.session
  const asset = state.assets.find((item) => item.id === assetId)

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  if (!asset || asset.status !== 'ready') {
    return { ok: false as const, reason: 'not_ready' as const }
  }

  if (isActionCoolingDown(asset, action, state.nowMs)) {
    return { ok: false as const, reason: 'cooldown' as const }
  }

  const result = await runtime.assetPort.regenerateAction(session, assetId, action, runtime.dataMode)

  if (!result.ok) {
    setWarehouseError(runtime, result.error)
    return { ok: false as const, reason: result.error.kind }
  }

  mergeWarehouseAsset(runtime, result.value)
  runtime.setState((current) => ({
    ...current,
    selectedAssetId: assetId,
    selectedAction: action,
    nowMs: runtime.getNowMs(),
  }))

  return { ok: true as const, asset: result.value }
}

export function editWarehouseAssetSource(runtime: WarehouseControllerRuntime, assetId: string) {
  const asset = runtime.getState().assets.find((item) => item.id === assetId)

  if (!asset || asset.status !== 'ready') {
    return { ok: false as const, reason: 'not_ready' as const }
  }

  if (asset.category === 'avatar') {
    runtime.routePort.navigateAvatarStudio(assetId)
  } else if (asset.category !== 'item') {
    runtime.routePort.navigateAssetStudio(assetId)
  }

  return { ok: true as const }
}

export function handleWarehouseAssetJobEvent(
  runtime: WarehouseControllerRuntime,
  event: AssetJobUpdateEvent,
) {
  runtime.setState((state) => ({
    ...state,
    nowMs: event.updatedAtMs ?? state.nowMs,
    assets: state.assets.map((asset) => {
      if (asset.id !== event.assetId) {
        return asset
      }

      return {
        ...asset,
        status: event.status,
        errorCode: event.action === undefined ? event.errorCode ?? asset.errorCode : asset.errorCode,
        errorMessage: event.action === undefined ? event.errorMessage ?? asset.errorMessage : asset.errorMessage,
        aiTrace: event.action === undefined ? event.aiTrace ?? asset.aiTrace : asset.aiTrace,
        sprites: asset.sprites.map((sprite) =>
          event.action === undefined || sprite.action === event.action
            ? {
                ...sprite,
                status: event.status,
                errorCode: event.errorCode ?? sprite.errorCode,
                errorMessage: event.errorMessage ?? sprite.errorMessage,
                aiTrace: event.aiTrace ?? sprite.aiTrace,
                lastRegenAt:
                  event.action === undefined || sprite.action === event.action
                    ? new Date(event.updatedAtMs ?? state.nowMs).toISOString()
                    : sprite.lastRegenAt,
              }
            : sprite,
        ),
      }
    }),
  }))
}

export function handleWarehouseConnectionEvent(
  runtime: WarehouseControllerRuntime,
  event: AssetJobConnectionEvent,
) {
  const wasReconnecting = runtime.getState().connectionStatus === 'reconnecting'

  runtime.setState((state) => ({
    ...state,
    connectionStatus: event.status,
    connectionMessage: event.message,
  }))

  return { shouldRefresh: wasReconnecting && event.status === 'online' }
}

export function tickWarehouseCooldown(runtime: WarehouseControllerRuntime, nowMs: number) {
  runtime.setState((state) => ({
    ...state,
    nowMs,
  }))
}

export function mapWarehouseAssetsToViewModels(
  assets: WarehouseAssetRecord[],
  session: LoginSession | null,
  nowMs: number,
): WarehouseAssetViewModel[] {
  return assets
    .filter((asset) => asset.category !== 'item')
    .map((asset) => mapWarehouseAssetToViewModel(asset, session, nowMs))
}

export function mapWarehouseAssetToViewModel(
  asset: WarehouseAssetRecord,
  session: LoginSession | null,
  nowMs: number,
): WarehouseAssetViewModel {
  return {
    id: asset.id,
    name: asset.name,
    description: asset.description,
    category: asset.category === 'item' ? 'platform' : asset.category,
    sourceImageUrl: asset.sourceImageUrl,
    status: mapAssetStatus(asset),
    statusText: getAssetStatusText(asset.status),
    estimateText: getAssetEstimateText(asset.status),
    progress: asset.status === 'generating' ? 48 : undefined,
    errorText: asset.status === 'failed' ? formatGenerationError(asset) : undefined,
    aiTrace: asset.aiTrace,
    isEquipped: asset.category === 'avatar' && session?.avatarAssetId === asset.id,
    isSystem: asset.isSystem,
    createdAtText: formatCreatedAt(asset.createdAt, nowMs),
    sizeText: formatAssetSize(asset),
    actions: getAssetActions(asset, nowMs),
  }
}

export function deriveWarehouseScreenState(
  state: WarehouseControllerState,
  viewModels: WarehouseAssetViewModel[],
): WarehouseScreenState {
  if (state.refreshing && state.assets.length === 0) {
    return 'loading'
  }

  if (state.connectionStatus === 'offline' || state.connectionStatus === 'server_unavailable') {
    return 'offline'
  }

  if (state.connectionStatus === 'reconnecting') {
    return 'reconnecting'
  }

  if (state.connectionStatus === 'malformed_response') {
    return 'malformedData'
  }

  if (state.selectedAssetId) {
    const selectedAsset = viewModels.find((asset) => asset.id === state.selectedAssetId)
    const selectedAction = selectedAsset?.actions.find((action) => action.id === state.selectedAction)

    return selectedAction?.status === 'cooling_down' ? 'cooldown' : 'details'
  }

  const visibleAssets = getVisibleViewModels(viewModels, state.selectedTab, state.selectedFilter)

  if (visibleAssets.length === 0) {
    return state.selectedTab === 'avatar' ? 'avatarEmpty' : 'componentEmpty'
  }

  const statuses = new Set(visibleAssets.map((asset) => asset.status))

  if (statuses.size > 1) {
    return 'mixed'
  }

  const status = statuses.values().next().value

  return status === 'malformed' ? 'malformedData' : status ?? 'mixed'
}

function getVisibleViewModels(
  assets: WarehouseAssetViewModel[],
  tab: WarehouseTab,
  filter: WarehouseFilter,
) {
  if (tab === 'avatar') {
    return assets.filter((asset) => asset.category === 'avatar' && !asset.isSystem)
  }

  return assets.filter((asset) => {
    if (asset.category === 'avatar' || asset.isSystem) {
      return false
    }

    return filter === 'all' || asset.category === filter
  })
}

function getAssetActions(asset: WarehouseAssetRecord, nowMs: number): WarehouseAssetAction[] {
  const actions = asset.sprites.length > 0 ? asset.sprites : getDefaultSprites(asset)

  return actions.map((sprite) => {
    if (asset.status === 'queued') {
      return {
        id: sprite.action,
        label: getActionLabel(sprite.action),
        status: 'disabled',
        disabledReason: '생성 대기 중입니다.',
      }
    }

    if (asset.status === 'generating' || sprite.status === 'queued' || sprite.status === 'generating') {
      return {
        id: sprite.action,
        label: getActionLabel(sprite.action),
        status: 'working',
        progress: 48,
      }
    }

    if (asset.status === 'failed') {
      return {
        id: sprite.action,
        label: getActionLabel(sprite.action),
        status: 'available',
        errorText: formatSpriteGenerationError(sprite),
        aiTrace: sprite.aiTrace,
      }
    }

    const remainingMs = getCooldownRemainingMs(sprite.lastRegenAt, nowMs)

    if (remainingMs > 0) {
      return {
        id: sprite.action,
        label: getActionLabel(sprite.action),
        status: 'cooling_down',
        cooldownText: formatRemainingTime(remainingMs),
      }
    }

    return {
      id: sprite.action,
      label: getActionLabel(sprite.action),
      status: 'available',
      errorText: formatSpriteGenerationError(sprite),
      aiTrace: sprite.aiTrace,
    }
  })
}

function getDefaultSprites(asset: WarehouseAssetRecord): WarehouseAssetSpriteRecord[] {
  if (asset.category === 'avatar') {
    return [
      { action: 'idle', status: asset.status },
      { action: 'walk', status: asset.status },
      { action: 'onair', status: asset.status },
    ]
  }

  return [{ action: 'static', status: asset.status }]
}

function getDefaultAction(asset: WarehouseAssetRecord | undefined) {
  return asset?.sprites[0]?.action ?? (asset?.category === 'avatar' ? 'idle' : 'static')
}

function isActionCoolingDown(
  asset: WarehouseAssetRecord,
  action: WarehouseReviewAction,
  nowMs: number,
) {
  const sprite = asset.sprites.find((item) => item.action === action)

  return getCooldownRemainingMs(sprite?.lastRegenAt, nowMs) > 0
}

function getCooldownRemainingMs(lastRegenAt: string | null | undefined, nowMs: number) {
  if (!lastRegenAt) {
    return 0
  }

  const lastMs = Date.parse(lastRegenAt)

  if (Number.isNaN(lastMs)) {
    return 0
  }

  return Math.max(0, lastMs + WAREHOUSE_REGEN_COOLDOWN_MS - nowMs)
}

function formatRemainingTime(remainingMs: number) {
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function mergeWarehouseAsset(runtime: WarehouseControllerRuntime, asset: WarehouseAssetRecord) {
  runtime.setState((state) => ({
    ...state,
    assets: [asset, ...state.assets.filter((item) => item.id !== asset.id)],
    connectionStatus: 'online',
    connectionMessage: undefined,
    nowMs: runtime.getNowMs(),
  }))
}

function setWarehouseError(runtime: WarehouseControllerRuntime, error: WarehouseControllerError) {
  runtime.setState((state) => ({
    ...state,
    connectionStatus: mapErrorToConnectionStatus(error),
    connectionMessage: error.message,
  }))
}

function mapErrorToConnectionStatus(error: WarehouseControllerError): WarehouseConnectionStatus {
  if (error.kind === 'authentication') {
    return 'authentication'
  }

  if (error.kind === 'offline') {
    return 'offline'
  }

  if (error.kind === 'reconnecting') {
    return 'reconnecting'
  }

  if (error.kind === 'malformed_response') {
    return 'malformed_response'
  }

  return 'server_unavailable'
}

function formatGenerationError(asset: Pick<WarehouseAssetRecord, 'errorCode' | 'errorMessage'>) {
  return [
    asset.errorMessage ?? '에셋 생성에 실패했어요. 다시 시도할 수 있어요.',
    asset.errorCode ? `오류 코드: ${asset.errorCode}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
}

function formatSpriteGenerationError(
  sprite: Pick<WarehouseAssetSpriteRecord, 'status' | 'errorCode' | 'errorMessage'>,
) {
  if (sprite.status !== 'failed' && !sprite.errorMessage && !sprite.errorCode) {
    return undefined
  }

  return [
    sprite.errorMessage ?? (sprite.status === 'failed' ? '이 액션 생성에 실패했어요.' : undefined),
    sprite.errorCode ? `오류 코드: ${sprite.errorCode}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
}

function hasAsset(assets: WarehouseAssetRecord[], assetId: string) {
  return assets.some((asset) => asset.id === assetId)
}

function mapAssetStatus(asset: WarehouseAssetRecord): WarehouseAssetStatus {
  return asset.status
}

function getAssetStatusText(status: WarehouseAssetRecord['status']) {
  const labels: Record<WarehouseAssetRecord['status'], string> = {
    queued: '대기 중',
    generating: '생성 중',
    ready: '사용 가능',
    failed: '생성 실패',
  }

  return labels[status]
}

function getAssetEstimateText(status: WarehouseAssetRecord['status']) {
  if (status === 'queued') {
    return '대기 중 · 예상 2~4분'
  }

  if (status === 'generating') {
    return '생성 중 · 남은 시간 약 3분'
  }

  return undefined
}

function getActionLabel(action: WarehouseReviewAction) {
  const labels: Record<WarehouseReviewAction, string> = {
    idle: '대기',
    walk: '걷기',
    onair: '공중',
    static: '정적',
  }

  return labels[action]
}

function formatAssetSize(asset: WarehouseAssetRecord) {
  if (asset.category === 'avatar') {
    return '256x512'
  }

  if (asset.widthCells !== null && asset.heightCells !== null) {
    return `${asset.widthCells}x${asset.heightCells}`
  }

  return undefined
}

function formatCreatedAt(createdAt: string, nowMs: number) {
  const createdMs = Date.parse(createdAt)

  if (Number.isNaN(createdMs)) {
    return '알 수 없음'
  }

  const diffMs = Math.max(0, nowMs - createdMs)
  const dayMs = 24 * 60 * 60 * 1000

  if (diffMs < 60 * 1000) {
    return '방금 전'
  }

  if (diffMs < 60 * 60 * 1000) {
    return `${Math.floor(diffMs / (60 * 1000))}분 전`
  }

  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / (60 * 60 * 1000))}시간 전`
  }

  return `${Math.floor(diffMs / dayMs)}일 전`
}
