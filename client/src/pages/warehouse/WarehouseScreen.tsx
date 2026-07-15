import {
  Badge,
  ConnectionState,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  Modal,
  ProgressBar,
  Tabs,
  type BadgeState,
  type ConnectionStatus,
} from '../../design-system/components'
import { Button, Text } from '../../design-system/primitives'
import { LauncherShell } from '../../design-system/shells'
import styles from './WarehouseScreen.module.css'

export type WarehouseScreenState =
  | 'loading'
  | 'avatarEmpty'
  | 'componentEmpty'
  | 'queued'
  | 'generating'
  | 'ready'
  | 'failed'
  | 'mixed'
  | 'details'
  | 'cooldown'
  | 'offline'
  | 'reconnecting'
  | 'malformedData'

export type WarehouseTab = 'avatar' | 'component'
export type WarehouseFilter = 'all' | 'platform' | 'obstacle' | 'monster' | 'background'
export type WarehouseAssetCategory = 'avatar' | 'platform' | 'obstacle' | 'monster' | 'background'
export type WarehouseAssetStatus = 'queued' | 'generating' | 'ready' | 'failed' | 'malformed'
export type WarehouseReviewAction = 'idle' | 'walk' | 'onair' | 'static'

export interface WarehouseAssetAction {
  id: WarehouseReviewAction
  label: string
  status: 'available' | 'cooling_down' | 'working' | 'disabled'
  cooldownText?: string
  progress?: number
  disabledReason?: string
}

export interface WarehouseAssetViewModel {
  id: string
  name: string
  description: string
  category: WarehouseAssetCategory
  sourceImageUrl?: string
  status: WarehouseAssetStatus
  statusText: string
  estimateText?: string
  progress?: number
  errorText?: string
  isEquipped?: boolean
  isSystem?: boolean
  createdAtText: string
  sizeText?: string
  actions: WarehouseAssetAction[]
}

export interface WarehouseScreenCallbacks {
  onGoMain: () => void
  onChangeTab: (tab: WarehouseTab) => void
  onChangeFilter: (filter: WarehouseFilter) => void
  onOpenAsset: (assetId: string) => void
  onCloseDetails: () => void
  onSelectReviewAction: (assetId: string, action: WarehouseReviewAction) => void
  onEquipAvatar: (assetId: string) => void
  onRetryAsset: (assetId: string) => void
  onRegenerateAction: (assetId: string, action: WarehouseReviewAction) => void
  onEditAsset: (assetId: string) => void
  onCreateAvatar: () => void
  onCreateComponent: () => void
  onRefresh: () => void
}

export interface WarehouseScreenProps extends WarehouseScreenCallbacks {
  state: WarehouseScreenState
  selectedTab: WarehouseTab
  selectedFilter: WarehouseFilter
  assets: WarehouseAssetViewModel[]
  selectedAssetId?: string
  selectedAction?: WarehouseReviewAction
  connectionStatus?: ConnectionStatus
  connectionMessage?: string
  refreshing?: boolean
}

export const warehouseFilters: Array<{ value: WarehouseFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'platform', label: '플랫폼' },
  { value: 'obstacle', label: '장애물' },
  { value: 'monster', label: '몬스터' },
  { value: 'background', label: '배경' },
]

export function WarehouseScreen({
  state,
  selectedTab,
  selectedFilter,
  assets,
  selectedAssetId,
  selectedAction,
  connectionStatus = 'online',
  connectionMessage,
  refreshing = false,
  onGoMain,
  onChangeTab,
  onChangeFilter,
  onOpenAsset,
  onCloseDetails,
  onSelectReviewAction,
  onEquipAvatar,
  onRetryAsset,
  onRegenerateAction,
  onEditAsset,
  onCreateAvatar,
  onCreateComponent,
  onRefresh,
}: WarehouseScreenProps) {
  const userAssets = assets.filter((asset) => !asset.isSystem)
  const visibleAssets = getVisibleAssets(userAssets, selectedTab, selectedFilter)
  const selectedAsset = userAssets.find((asset) => asset.id === selectedAssetId)
  const summary = getWarehouseSummary(userAssets)
  const avatarCount = userAssets.filter((asset) => asset.category === 'avatar').length
  const componentCount = userAssets.length - avatarCount
  const shellState = getShellState(state, connectionStatus)
  const isEmptyState =
    state === 'avatarEmpty' ||
    state === 'componentEmpty' ||
    (state !== 'loading' && visibleAssets.length === 0)

  return (
    <LauncherShell
      className={styles.shell}
      title="멀티플레이 AI 릴레이 맵 메이커"
      subtitle="S2b Warehouse"
      state={shellState}
      status={
        <Badge
          state={getConnectionBadgeState(connectionStatus)}
          label={getShellStatusLabel(connectionStatus)}
        />
      }
      primaryNav={
        <Button variant="secondary" size="small" onClick={onGoMain}>
          메인으로
        </Button>
      }
      actions={
        <Button
          size="small"
          loading={refreshing}
          disabled={connectionStatus === 'offline' || connectionStatus === 'malformed_response'}
          onClick={onRefresh}
        >
          새로고침
        </Button>
      }
      data-v2-screen="s2b-warehouse"
      data-v2-state={state}
    >
      <div className={styles.screen} data-v2-component="warehouse-screen" data-v2-state={state}>
        <header className={styles.heading}>
          <div className={styles.headingCopy}>
            <p className={styles.eyebrow}>내 창고</p>
            <h2>에셋을 확인하고 사용할 준비를 해요</h2>
            <p>아바타와 컴포넌트 에셋의 생성 상태, 상세 정보, 재생성 쿨다운을 확인합니다.</p>
          </div>
          <Button
            variant="secondary"
            onClick={selectedTab === 'avatar' ? onCreateAvatar : onCreateComponent}
            data-v2-component="warehouse-create-action"
          >
            {selectedTab === 'avatar' ? '아바타 만들기' : '에셋 만들기'}
          </Button>
        </header>

        {connectionStatus !== 'online' ? (
          <ConnectionState
            status={connectionStatus}
            message={connectionMessage}
            action={connectionStatus === 'reconnecting' ? undefined : { label: '다시 시도', onPress: onRefresh }}
          />
        ) : null}

        <dl className={styles.summaryGrid} aria-label="창고 요약">
          <SummaryMetric label="내가 만든 에셋" value={summary.total} />
          <SummaryMetric label="사용 가능" value={summary.ready} />
          <SummaryMetric label="작업 중" value={summary.working} />
          <SummaryMetric label="실패" value={summary.failed} />
        </dl>

        <section className={styles.toolbar} aria-label="창고 보기 설정">
          <Tabs
            ariaLabel="창고 탭"
            selectedValue={selectedTab}
            onChange={(value) => onChangeTab(isWarehouseTab(value) ? value : 'avatar')}
            tabs={[
              { value: 'avatar', label: '아바타', badge: <span>{avatarCount}</span>, panelId: 'warehouse-assets-panel' },
              {
                value: 'component',
                label: '컴포넌트 에셋',
                badge: <span>{componentCount}</span>,
                panelId: 'warehouse-assets-panel',
              },
            ]}
          />
          {selectedTab === 'component' ? (
            <div className={styles.filterRow} aria-label="컴포넌트 필터">
              {warehouseFilters.map((filter) => (
                <FilterChip
                  key={filter.value}
                  label={filter.label}
                  selected={selectedFilter === filter.value}
                  count={getVisibleAssets(userAssets, 'component', filter.value).length}
                  onPress={() => onChangeFilter(filter.value)}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section
          id="warehouse-assets-panel"
          className={styles.panel}
          role="tabpanel"
          data-v2-component="warehouse-assets-panel"
          data-v2-state={state}
        >
          {renderPanelContent({
            state,
            selectedTab,
            visibleAssets,
            isEmptyState,
            onOpenAsset,
            onCreateAvatar,
            onCreateComponent,
            onRefresh,
          })}
        </section>
      </div>

      <AssetReviewModal
        open={Boolean(selectedAsset)}
        asset={selectedAsset}
        selectedAction={selectedAction}
        onSelectAction={onSelectReviewAction}
        onClose={onCloseDetails}
        onEquipAvatar={onEquipAvatar}
        onRetryAsset={onRetryAsset}
        onRegenerateAction={onRegenerateAction}
        onEditAsset={onEditAsset}
      />
    </LauncherShell>
  )
}

interface RenderPanelContentInput {
  state: WarehouseScreenState
  selectedTab: WarehouseTab
  visibleAssets: WarehouseAssetViewModel[]
  isEmptyState: boolean
  onOpenAsset: (assetId: string) => void
  onCreateAvatar: () => void
  onCreateComponent: () => void
  onRefresh: () => void
}

function renderPanelContent({
  state,
  selectedTab,
  visibleAssets,
  isEmptyState,
  onOpenAsset,
  onCreateAvatar,
  onCreateComponent,
  onRefresh,
}: RenderPanelContentInput) {
  if (state === 'loading') {
    return (
      <LoadingState
        label="에셋을 불러오는 중"
        message="창고 카드의 위치가 흔들리지 않도록 영역을 유지합니다."
      />
    )
  }

  if (state === 'malformedData') {
    return (
      <div className={styles.panelStack}>
        <ErrorState
          title="서버 응답 형식이 올바르지 않아요."
          message="일부 에셋은 상세 확인만 가능하고 사용할 수 없습니다."
          action={{ label: '다시 시도', onPress: onRefresh }}
        />
        <AssetGrid assets={visibleAssets} onOpenAsset={onOpenAsset} />
      </div>
    )
  }

  if (isEmptyState) {
    const isAvatar = selectedTab === 'avatar'

    return (
      <EmptyState
        title={isAvatar ? '아직 만든 아바타가 없어요.' : '아직 만든 컴포넌트 에셋이 없어요.'}
        message={isAvatar ? '기본 아바타로도 게임을 시작할 수 있어요.' : '플랫폼, 장애물, 몬스터, 배경을 직접 만들 수 있어요.'}
        action={{
          label: isAvatar ? '아바타 만들기' : '에셋 만들기',
          onPress: isAvatar ? onCreateAvatar : onCreateComponent,
        }}
      />
    )
  }

  return <AssetGrid assets={visibleAssets} onOpenAsset={onOpenAsset} />
}

function AssetGrid({
  assets,
  onOpenAsset,
}: {
  assets: WarehouseAssetViewModel[]
  onOpenAsset: (assetId: string) => void
}) {
  return (
    <div className={styles.assetGrid} data-v2-component="warehouse-asset-grid">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} onOpen={() => onOpenAsset(asset.id)} />
      ))}
    </div>
  )
}

export function AssetCard({
  asset,
  selected = false,
  onOpen,
}: {
  asset: WarehouseAssetViewModel
  selected?: boolean
  onOpen: () => void
}) {
  const isWorking = asset.status === 'queued' || asset.status === 'generating'
  const isMalformed = asset.status === 'malformed'
  const canUse = asset.status === 'ready'

  return (
    <article
      className={styles.assetCard}
      data-v2-component="asset-card"
      data-v2-state={asset.status}
      data-selected={selected ? 'true' : undefined}
    >
      <AssetPreview asset={asset} />
      <div className={styles.assetCardBody}>
        <div className={styles.assetCardTitle}>
          <h3>{asset.name}</h3>
          {asset.isEquipped ? <Badge state="ready" label="장착 중" /> : null}
        </div>
        <p>{asset.description}</p>
        <div className={styles.assetMetaRow}>
          <Badge state={getBadgeState(asset.status)} label={asset.statusText} />
          <span>{getCategoryLabel(asset.category)}</span>
        </div>
        {asset.estimateText ? <span className={styles.helperText}>{asset.estimateText}</span> : null}
        {asset.progress !== undefined ? (
          <ProgressBar value={asset.progress} label={`${asset.name} 생성 진행률`} />
        ) : null}
        {isWorking ? <span className={styles.disabledReason}>생성이 끝난 뒤 사용할 수 있어요.</span> : null}
        {isMalformed ? <span className={styles.disabledReason}>서버 응답 형식이 올바르지 않아요.</span> : null}
      </div>
      <div className={styles.assetCardActions}>
        <Button
          variant={canUse ? 'secondary' : 'ghost'}
          size="small"
          disabled={isMalformed}
          onClick={onOpen}
          data-v2-component="asset-card-open"
        >
          상세 보기
        </Button>
      </div>
    </article>
  )
}

export function AssetPreview({ asset }: { asset: WarehouseAssetViewModel }) {
  const unavailable = asset.status === 'malformed'
  const hasSourceImage = typeof asset.sourceImageUrl === 'string' && asset.sourceImageUrl.length > 0

  return (
    <div
      className={styles.assetPreview}
      role="img"
      aria-label={`${asset.name} ${getCategoryLabel(asset.category)} 미리보기`}
      data-v2-component="asset-preview"
      data-v2-state={unavailable ? 'unavailable' : 'static'}
      data-category={asset.category}
      data-status={asset.status}
      data-has-source-image={hasSourceImage ? 'true' : 'false'}
    >
      {hasSourceImage ? (
        <img className={styles.previewImage} src={asset.sourceImageUrl} alt="" aria-hidden="true" />
      ) : (
        <span className={styles.previewStage} aria-hidden="true">
          <span className={styles.previewShape} />
        </span>
      )}
      {unavailable ? <span className={styles.previewUnavailable}>표시할 수 없음</span> : null}
    </div>
  )
}

export function AssetReviewModal({
  open,
  asset,
  selectedAction,
  onSelectAction,
  onClose,
  onEquipAvatar,
  onRetryAsset,
  onRegenerateAction,
  onEditAsset,
}: {
  open: boolean
  asset: WarehouseAssetViewModel | undefined
  selectedAction?: WarehouseReviewAction
  onSelectAction: (assetId: string, action: WarehouseReviewAction) => void
  onClose: () => void
  onEquipAvatar: (assetId: string) => void
  onRetryAsset: (assetId: string) => void
  onRegenerateAction: (assetId: string, action: WarehouseReviewAction) => void
  onEditAsset: (assetId: string) => void
}) {
  const activeAction = selectedAction ?? asset?.actions[0]?.id
  const activeActionModel = asset?.actions.find((action) => action.id === activeAction)
  const canUseAsset = asset?.status === 'ready'
  const canRetryAsset = asset?.status === 'failed'
  const isMalformed = asset?.status === 'malformed'

  return (
    <Modal
      open={open && Boolean(asset)}
      title={asset ? `${asset.name} 상세` : '에셋 상세'}
      description="미리보기, 상태, 액션별 재생성 쿨다운을 확인합니다."
      size="large"
      onClose={() => onClose()}
    >
      {asset ? (
        <div className={styles.reviewModal} data-v2-component="asset-review-modal" data-v2-state={asset.status}>
          <AssetPreview asset={asset} />
          <section className={styles.reviewDetails} aria-label="에셋 상세 정보">
            <div className={styles.reviewHeader}>
              <div>
                <Text variant="caption" tone="secondary" weight="bold">
                  {getCategoryLabel(asset.category)}
                </Text>
                <h3>{asset.name}</h3>
                <p>{asset.description}</p>
              </div>
              <Badge state={getBadgeState(asset.status)} label={asset.statusText} />
            </div>
            <dl className={styles.detailGrid}>
              <div>
                <dt>생성일</dt>
                <dd>{asset.createdAtText}</dd>
              </div>
              <div>
                <dt>크기</dt>
                <dd>{asset.sizeText ?? '자동'}</dd>
              </div>
              <div>
                <dt>사용 가능</dt>
                <dd>{canUseAsset ? '가능' : '불가'}</dd>
              </div>
            </dl>
            {asset.errorText ? (
              <ErrorState title="에셋 생성에 실패했어요." message={asset.errorText} />
            ) : null}
            {isMalformed ? (
              <ErrorState
                title="에셋 데이터를 읽을 수 없어요."
                message="형식이 올바른 응답을 받은 뒤 사용할 수 있습니다."
              />
            ) : null}
            {asset.actions.length > 0 ? (
              <div className={styles.actionReview}>
                <Tabs
                  ariaLabel="재생성 액션"
                  selectedValue={activeAction ?? asset.actions[0].id}
                  onChange={(value) => {
                    if (isWarehouseReviewAction(value)) {
                      onSelectAction(asset.id, value)
                    }
                  }}
                  tabs={asset.actions.map((action) => ({
                    value: action.id,
                    label: action.label,
                  }))}
                />
                {activeActionModel ? (
                  <div className={styles.actionStatus} data-v2-state={activeActionModel.status}>
                    <span>{getActionStatusText(activeActionModel)}</span>
                    {activeActionModel.progress !== undefined ? (
                      <ProgressBar value={activeActionModel.progress} label={`${activeActionModel.label} 재생성 진행률`} />
                    ) : null}
                    <CooldownButton
                      status={activeActionModel.status}
                      cooldownText={activeActionModel.cooldownText}
                      disabledReason={activeActionModel.disabledReason}
                      onPress={() => onRegenerateAction(asset.id, activeActionModel.id)}
                    >
                      재생성
                    </CooldownButton>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className={styles.reviewActions}>
              {asset.category === 'avatar' ? (
                <Button
                  disabled={!canUseAsset || asset.isEquipped}
                  onClick={() => onEquipAvatar(asset.id)}
                >
                  {asset.isEquipped ? '장착 중' : '장착'}
                </Button>
              ) : null}
              {canRetryAsset ? (
                <Button variant="danger" onClick={() => onRetryAsset(asset.id)}>
                  다시 시도
                </Button>
              ) : null}
              <Button
                variant="secondary"
                disabled={!canUseAsset}
                onClick={() => onEditAsset(asset.id)}
              >
                그림·속성 수정하기
              </Button>
              <Button variant="ghost" onClick={onClose}>
                닫기
              </Button>
            </div>
            {!canUseAsset && !isMalformed ? (
              <span className={styles.disabledReason}>생성이 끝난 뒤 사용할 수 있어요.</span>
            ) : null}
          </section>
        </div>
      ) : null}
    </Modal>
  )
}

export function CooldownButton({
  status,
  cooldownText,
  disabledReason,
  onPress,
  children,
}: {
  status: WarehouseAssetAction['status']
  cooldownText?: string
  disabledReason?: string
  onPress: () => void
  children: string
}) {
  const isCoolingDown = status === 'cooling_down'
  const isWorking = status === 'working'
  const isDisabled = status === 'disabled' || isCoolingDown || isWorking
  const label = isCoolingDown && cooldownText ? `${children} · ${cooldownText}` : children
  const helper = isCoolingDown ? cooldownText : disabledReason

  return (
    <div className={styles.cooldownButton} data-v2-component="cooldown-button" data-v2-state={status}>
      <Button
        variant={status === 'disabled' ? 'ghost' : 'secondary'}
        size="small"
        disabled={isDisabled}
        loading={isWorking}
        onClick={onPress}
        aria-label={helper ? `${label}. ${helper}` : label}
      >
        {label}
      </Button>
      {helper ? <span>{helper}</span> : null}
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.summaryMetric}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function getWarehouseSummary(assets: WarehouseAssetViewModel[]) {
  return {
    total: assets.length,
    ready: assets.filter((asset) => asset.status === 'ready').length,
    working: assets.filter((asset) => asset.status === 'queued' || asset.status === 'generating').length,
    failed: assets.filter((asset) => asset.status === 'failed' || asset.status === 'malformed').length,
  }
}

function getVisibleAssets(
  assets: WarehouseAssetViewModel[],
  selectedTab: WarehouseTab,
  selectedFilter: WarehouseFilter,
) {
  if (selectedTab === 'avatar') {
    return assets.filter((asset) => asset.category === 'avatar')
  }

  return assets.filter((asset) => {
    if (asset.category === 'avatar') {
      return false
    }

    return selectedFilter === 'all' || asset.category === selectedFilter
  })
}

function getShellState(
  state: WarehouseScreenState,
  connectionStatus: ConnectionStatus,
) {
  if (
    connectionStatus === 'offline' ||
    connectionStatus === 'server_unavailable' ||
    connectionStatus === 'malformed_response' ||
    state === 'offline'
  ) {
    return 'offline'
  }

  if (connectionStatus === 'reconnecting' || state === 'reconnecting') {
    return 'reconnecting'
  }

  if (state === 'loading') {
    return 'loading'
  }

  return 'default'
}

function getShellStatusLabel(connectionStatus: ConnectionStatus) {
  if (connectionStatus === 'offline') {
    return '오프라인'
  }

  if (connectionStatus === 'reconnecting') {
    return '다시 연결 중'
  }

  if (connectionStatus === 'server_unavailable') {
    return '서버에 연결할 수 없음'
  }

  if (connectionStatus === 'malformed_response') {
    return '응답 형식 오류'
  }

  return '창고 준비됨'
}

function getConnectionBadgeState(connectionStatus: ConnectionStatus): BadgeState {
  if (connectionStatus === 'reconnecting') {
    return 'reconnecting'
  }

  if (connectionStatus !== 'online') {
    return 'offline'
  }

  return 'ready'
}

function getBadgeState(status: WarehouseAssetStatus): BadgeState {
  if (status === 'queued') {
    return 'queued'
  }

  if (status === 'generating') {
    return 'generating'
  }

  if (status === 'ready') {
    return 'ready'
  }

  return 'failed'
}

function getCategoryLabel(category: WarehouseAssetCategory) {
  const labels: Record<WarehouseAssetCategory, string> = {
    avatar: '아바타',
    platform: '플랫폼',
    obstacle: '장애물',
    monster: '몬스터',
    background: '배경',
  }

  return labels[category]
}

function getActionStatusText(action: WarehouseAssetAction) {
  if (action.status === 'cooling_down') {
    return action.cooldownText ? `${action.cooldownText} 후 다시 시도 가능` : '잠시 후 다시 시도 가능'
  }

  if (action.status === 'working') {
    return '재생성 중'
  }

  if (action.status === 'disabled') {
    return action.disabledReason ?? '현재 사용할 수 없어요.'
  }

  return '재생성할 수 있어요.'
}

function isWarehouseTab(value: string): value is WarehouseTab {
  return value === 'avatar' || value === 'component'
}

function isWarehouseReviewAction(value: string): value is WarehouseReviewAction {
  return value === 'idle' || value === 'walk' || value === 'onair' || value === 'static'
}
