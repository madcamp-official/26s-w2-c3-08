import type {
  AssetLoadItem,
  AssetLoadTab,
  PaletteSwatchModel,
  StudioToolId,
  ToolButtonProps,
} from '../../design-system/studio'
import type { LoginDataMode, LoginSession, StoragePort } from '../login/loginControllerCore'
import type {
  AssetStudioAttrs,
  AssetStudioCategory,
  AssetStudioFormValue,
  AssetStudioLayoutValue,
  AssetStudioScreenProps,
  AssetStudioScreenState,
  AssetStudioSize,
} from './AssetStudioScreen'

export const ASSET_STUDIO_CELL_PX = 32

const assetStudioToolModels: ToolButtonProps['tool'][] = [
  { id: 'pen', label: '펜', shortcut: 'P' },
  { id: 'eraser', label: '지우개', shortcut: 'E' },
  { id: 'eyedropper', label: '스포이드', shortcut: 'I' },
  { id: 'move', label: '전체 이동', shortcut: 'M' },
  { id: 'undo', label: '실행취소', shortcut: 'Z' },
  { id: 'redo', label: '다시실행', shortcut: 'Y' },
  { id: 'clear', label: '전체지우기' },
]

const assetStudioPaletteSwatches: PaletteSwatchModel[] = [
  { id: 'transparent', name: '투명', value: 'transparent', transparent: true },
  { id: 'ink', name: '잉크', value: 'var(--semantic-color-text-primary)' },
  { id: 'yellow', name: '건설 노랑', value: 'var(--semantic-color-action-primary-background)' },
  { id: 'sky', name: '하늘 파랑', value: 'var(--semantic-color-status-generating)' },
  { id: 'green', name: '지형 초록', value: 'var(--semantic-color-status-success)' },
  { id: 'danger', name: '위험 빨강', value: 'var(--semantic-color-status-error)' },
  { id: 'warning', name: '경고 갈색', value: 'var(--semantic-color-status-warning)' },
]

const assetStudioRecentSwatchIds = ['yellow', 'sky', 'green']
const assetStudioBrushSizePresets = [2, 4, 8]

export interface AssetStudioControllerError {
  kind:
    | 'validation'
    | 'authentication'
    | 'not_found'
    | 'offline'
    | 'server_unavailable'
    | 'malformed_response'
    | 'export_failure'
  message: string
  retryable: boolean
}

export type AssetStudioResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: AssetStudioControllerError
    }

export interface AssetStudioAssetRecord {
  id: string
  creatorId: string | null
  category: AssetStudioCategory
  name: string
  description: string
  attrs: Record<string, string | number | boolean | null>
  widthCells: number
  heightCells: number
  status: 'queued' | 'generating' | 'ready' | 'failed'
  sourceImageUrl?: string
  isMine: boolean
}

export interface AssetStudioSubmitPayload {
  userId: string
  sessionToken: string
  category: AssetStudioCategory
  name: string
  description: string
  image: string
  attrs: Record<string, string | number | boolean | null>
  widthCells: number
  heightCells: number
  remixOfId?: string | null
}

export interface AssetStudioAssetPort {
  listLoadableAssets(
    session: LoginSession,
    dataMode: LoginDataMode,
  ): Promise<AssetStudioResult<AssetStudioAssetRecord[]>>
  createComponentAsset(
    payload: AssetStudioSubmitPayload,
    dataMode: LoginDataMode,
  ): Promise<AssetStudioResult<AssetStudioAssetRecord>>
}

export interface AssetStudioDrawingPort {
  getHash(): string
  reset(size: AssetStudioSize): AssetStudioResult<{ hash: string }>
  resizeAndResample(
    size: AssetStudioSize,
    mode: 'nearest' | 'smoothed',
  ): AssetStudioResult<{ hash: string }>
  loadAssetSource(asset: AssetStudioAssetRecord): AssetStudioResult<{ hash: string }>
  exportPng(): AssetStudioResult<{ image: string; hash: string }>
  undo(): boolean
  redo(): boolean
  clear(): AssetStudioResult<{ hash: string }>
}

export interface AssetStudioLayoutStorage {
  loadLayout(): AssetStudioLayoutValue
  saveLayout(layout: AssetStudioLayoutValue): void
}

export interface AssetStudioRoutePort {
  navigateLogin(): void
  navigateMain(): void
  navigateWarehouseComponent(): void
}

export interface AssetStudioControllerState {
  session: LoginSession | null
  viewState: AssetStudioScreenState
  form: AssetStudioFormValue
  layout: AssetStudioLayoutValue
  activeTool: StudioToolId
  brushSize: number
  opacity: number
  selectedSwatchId: string
  recentSwatchIds: string[]
  checkerMode: 'light' | 'dark'
  gridVisible: boolean
  loadModalOpen: boolean
  loadModalTab: AssetLoadTab
  loadableAssets: AssetStudioAssetRecord[]
  loadAssetsLoading: boolean
  loadedSource?: {
    assetId: string
    name: string
    baselineHash: string
  }
  lastSubmittedHash?: string
  submitError?: string
  toastVisible: boolean
}

export interface AssetStudioControllerRuntime {
  dataMode: LoginDataMode
  sessionStoragePort: StoragePort
  layoutStorage: AssetStudioLayoutStorage
  assetPort: AssetStudioAssetPort
  drawingPort: AssetStudioDrawingPort
  routePort: AssetStudioRoutePort
  getState: () => AssetStudioControllerState
  setState: (updater: (state: AssetStudioControllerState) => AssetStudioControllerState) => void
}

export interface AssetStudioBootOptions {
  mode?: 'new' | 'edit' | 'remix'
  sourceAssetId?: string
}

export function createDefaultAssetStudioForm(): AssetStudioFormValue {
  return {
    name: '',
    description: '',
    category: 'platform',
    size: { widthCells: 2, heightCells: 1 },
    attrs: {
      behaviors: ['solid'],
      collider: 'solid',
      motion: 'static',
    },
  }
}

export function createDefaultAssetStudioLayout(): AssetStudioLayoutValue {
  return {
    leftCollapsed: false,
    rightCollapsed: false,
    leftPanelWidth: 292,
    rightPanelWidth: 340,
    toolBlockRatio: 0.56,
    resizing: null,
  }
}

export function createInitialAssetStudioControllerState(
  layout: AssetStudioLayoutValue = createDefaultAssetStudioLayout(),
): AssetStudioControllerState {
  return {
    session: null,
    viewState: 'default',
    form: createDefaultAssetStudioForm(),
    layout,
    activeTool: 'pen',
    brushSize: 4,
    opacity: 1,
    selectedSwatchId: 'yellow',
    recentSwatchIds: assetStudioRecentSwatchIds,
    checkerMode: 'light',
    gridVisible: true,
    loadModalOpen: false,
    loadModalTab: 'mine',
    loadableAssets: [],
    loadAssetsLoading: false,
    loadedSource: undefined,
    lastSubmittedHash: undefined,
    submitError: undefined,
    toastVisible: false,
  }
}

export async function bootAssetStudioController(
  runtime: AssetStudioControllerRuntime,
  options: AssetStudioBootOptions = {},
) {
  const session = runtime.sessionStoragePort.loadSession()
  const layout = runtime.layoutStorage.loadLayout()

  runtime.setState((state) => ({
    ...state,
    session,
    layout,
  }))

  if (!session) {
    runtime.routePort.navigateLogin()
    return { destination: 'login' as const, reason: 'no_session' as const }
  }

  await refreshAssetStudioLoadableAssets(runtime)

  if (options.sourceAssetId) {
    const loadResult = loadAssetStudioSource(runtime, options.sourceAssetId)

    return {
      destination: 'assetStudio' as const,
      reason: loadResult.ok ? options.mode ?? 'edit' : loadResult.reason,
    }
  }

  return { destination: 'assetStudio' as const, reason: 'loaded' as const }
}

export async function refreshAssetStudioLoadableAssets(runtime: AssetStudioControllerRuntime) {
  const session = runtime.getState().session ?? runtime.sessionStoragePort.loadSession()

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  runtime.setState((state) => ({
    ...state,
    session,
    loadAssetsLoading: true,
  }))

  const result = await runtime.assetPort.listLoadableAssets(session, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((state) => ({
      ...state,
      viewState: mapErrorToViewState(result.error),
      loadAssetsLoading: false,
      submitError: result.error.message,
    }))

    return { ok: false as const, reason: result.error.kind }
  }

  runtime.setState((state) => ({
    ...state,
    loadableAssets: result.value,
    loadAssetsLoading: false,
  }))

  return { ok: true as const, assets: result.value }
}

export function createAssetStudioScreenProps(
  runtime: AssetStudioControllerRuntime,
): AssetStudioScreenProps {
  const state = runtime.getState()
  const contentHash = createAssetStudioContentHash(state, runtime.drawingPort.getHash())
  const dirtyState = deriveDirtyState(state, contentHash)

  return {
    state: deriveAssetStudioScreenState(state, dirtyState),
    form: state.form,
    layout: state.layout,
    activeTool: state.activeTool,
    disabledToolIds: createDisabledToolIds(state),
    tools: assetStudioToolModels,
    brushSize: state.brushSize,
    brushSizePresets: assetStudioBrushSizePresets,
    opacity: state.opacity,
    swatches: assetStudioPaletteSwatches,
    selectedSwatchId: state.selectedSwatchId,
    recentSwatchIds: state.recentSwatchIds,
    checkerMode: state.checkerMode,
    gridVisible: state.gridVisible,
    dirtyState,
    sourceAssetName: state.loadedSource?.name,
    submitDisabledReason: deriveSubmitDisabledReason(state, contentHash),
    loadModalOpen: state.loadModalOpen,
    loadModalTab: state.loadModalTab,
    loadAssets: mapLoadableAssets(state.loadableAssets, state.loadModalTab),
    loadAssetsLoading: state.loadAssetsLoading,
    toast: state.toastVisible
      ? {
          tone: 'success',
          title: '에셋 생성을 요청했어요.',
          message: '창고에서 진행 상황을 볼 수 있습니다.',
          actionLabel: '창고에서 진행 상황 보기',
        }
      : undefined,
    submitError: state.submitError,
    ...createAssetStudioCallbacks(runtime),
  }
}

export function createAssetStudioCallbacks(
  runtime: AssetStudioControllerRuntime,
): Pick<
  AssetStudioScreenProps,
  | 'onGoMain'
  | 'onOpenWarehouse'
  | 'onNewAsset'
  | 'onToggleLeftPanel'
  | 'onToggleRightPanel'
  | 'onResizePanel'
  | 'onResizeToolBlock'
  | 'onToolChange'
  | 'onBrushSizeChange'
  | 'onOpacityChange'
  | 'onSelectColor'
  | 'onToggleCheckerMode'
  | 'onToggleGrid'
  | 'onUndo'
  | 'onRedo'
  | 'onClear'
  | 'onOpenLoadModal'
  | 'onCloseLoadModal'
  | 'onLoadTabChange'
  | 'onSelectLoadAsset'
  | 'onNameChange'
  | 'onDescriptionChange'
  | 'onCategoryChange'
  | 'onSizeChange'
  | 'onAttrsChange'
  | 'onSubmit'
  | 'onDismissToast'
> {
  return {
    onGoMain: () => runtime.routePort.navigateMain(),
    onOpenWarehouse: () => runtime.routePort.navigateWarehouseComponent(),
    onNewAsset: () => resetAssetStudio(runtime),
    onToggleLeftPanel: () => updateAssetStudioLayout(runtime, (layout) => ({
      ...layout,
      leftCollapsed: !layout.leftCollapsed,
      resizing: null,
    })),
    onToggleRightPanel: () => updateAssetStudioLayout(runtime, (layout) => ({
      ...layout,
      rightCollapsed: !layout.rightCollapsed,
      resizing: null,
    })),
    onResizePanel: (side, delta) => resizeAssetStudioPanel(runtime, side, delta),
    onResizeToolBlock: (delta) => updateAssetStudioLayout(runtime, (layout) => ({
      ...layout,
      toolBlockRatio: clampRatio(layout.toolBlockRatio + delta),
      resizing: 'tools',
    })),
    onToolChange: (toolId) => setAssetStudioTool(runtime, toolId),
    onBrushSizeChange: (brushSize) => setAssetStudioBrushSize(runtime, brushSize),
    onOpacityChange: (opacity) => setAssetStudioOpacity(runtime, opacity),
    onSelectColor: (swatchId) => selectAssetStudioColor(runtime, swatchId),
    onToggleCheckerMode: () => toggleAssetStudioChecker(runtime),
    onToggleGrid: () => toggleAssetStudioGrid(runtime),
    onUndo: () => {
      runtime.drawingPort.undo()
      markAssetStudioChanged(runtime)
    },
    onRedo: () => {
      runtime.drawingPort.redo()
      markAssetStudioChanged(runtime)
    },
    onClear: () => clearAssetStudioCanvas(runtime),
    onOpenLoadModal: () => openAssetStudioLoadModal(runtime),
    onCloseLoadModal: () => closeAssetStudioLoadModal(runtime),
    onLoadTabChange: (tab) => setAssetStudioLoadTab(runtime, tab),
    onSelectLoadAsset: (assetId) => loadAssetStudioSource(runtime, assetId),
    onNameChange: (name) => updateAssetStudioForm(runtime, { name }),
    onDescriptionChange: (description) => updateAssetStudioForm(runtime, { description }),
    onCategoryChange: (category) => updateAssetStudioForm(runtime, { category }),
    onSizeChange: (size) => resizeAssetStudioCanvas(runtime, size),
    onAttrsChange: (attrs) => updateAssetStudioForm(runtime, { attrs }),
    onSubmit: () => {
      void submitAssetStudio(runtime)
    },
    onDismissToast: () => runtime.setState((state) => ({ ...state, toastVisible: false })),
  }
}

export function updateAssetStudioForm(
  runtime: AssetStudioControllerRuntime,
  patch: Partial<AssetStudioFormValue>,
) {
  runtime.setState((state) => ({
    ...state,
    form: {
      ...state.form,
      ...patch,
    },
    viewState: state.loadedSource ? 'loadedChanged' : 'default',
    submitError: undefined,
    toastVisible: false,
  }))
}

export function resizeAssetStudioCanvas(
  runtime: AssetStudioControllerRuntime,
  size: AssetStudioSize,
) {
  const normalizedSize = normalizeAssetStudioSize(size)
  const result = runtime.drawingPort.resizeAndResample(normalizedSize, 'nearest')

  runtime.setState((state) => ({
    ...state,
    form: {
      ...state.form,
      size: normalizedSize,
    },
    viewState: result.ok ? 'sizeChanged' : 'submitFailed',
    submitError: result.ok ? undefined : result.error.message,
    toastVisible: false,
  }))

  return result.ok
    ? { ok: true as const, size: normalizedSize }
    : { ok: false as const, reason: result.error.kind }
}

export function loadAssetStudioSource(
  runtime: AssetStudioControllerRuntime,
  assetId: string,
) {
  const asset = runtime.getState().loadableAssets.find((item) => item.id === assetId)

  if (!asset || asset.status !== 'ready') {
    return { ok: false as const, reason: 'not_found' as const }
  }

  const result = runtime.drawingPort.loadAssetSource(asset)

  if (!result.ok) {
    runtime.setState((state) => ({
      ...state,
      viewState: 'submitFailed',
      submitError: result.error.message,
    }))
    return { ok: false as const, reason: result.error.kind }
  }

  runtime.setState((state) => ({
    ...state,
    form: {
      name: asset.name,
      description: asset.description,
      category: asset.category,
      size: {
        widthCells: asset.widthCells,
        heightCells: asset.heightCells,
      },
      attrs: deserializeAssetStudioAttrs(asset.attrs),
    },
    loadedSource: {
      assetId: asset.id,
      name: asset.name,
      baselineHash: createAssetStudioContentHash(
        {
          ...state,
          form: {
            name: asset.name,
            description: asset.description,
            category: asset.category,
            size: {
              widthCells: asset.widthCells,
              heightCells: asset.heightCells,
            },
            attrs: deserializeAssetStudioAttrs(asset.attrs),
          },
        },
        result.value.hash,
      ),
    },
    loadModalOpen: false,
    viewState: 'loadedUnchanged',
    submitError: undefined,
    toastVisible: false,
  }))

  return { ok: true as const, asset }
}

export async function submitAssetStudio(runtime: AssetStudioControllerRuntime) {
  const state = runtime.getState()
  const contentHash = createAssetStudioContentHash(state, runtime.drawingPort.getHash())
  const disabledReason = deriveSubmitDisabledReason(state, contentHash)

  if (disabledReason) {
    runtime.setState((current) => ({
      ...current,
      viewState: state.form.name.trim().length === 0 ? 'invalidMissingName' : current.viewState,
      submitError: disabledReason,
    }))

    return { ok: false as const, reason: 'validation' as const }
  }

  const exportResult = runtime.drawingPort.exportPng()

  if (!exportResult.ok) {
    runtime.setState((current) => ({
      ...current,
      viewState: 'submitFailed',
      submitError: exportResult.error.message,
    }))

    return { ok: false as const, reason: exportResult.error.kind }
  }

  const session = state.session ?? runtime.sessionStoragePort.loadSession()

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  runtime.setState((current) => ({
    ...current,
    session,
    viewState: 'submitting',
    submitError: undefined,
    toastVisible: false,
  }))

  const payload = createAssetStudioSubmitPayload(state, session, exportResult.value.image)
  const result = await runtime.assetPort.createComponentAsset(payload, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      viewState: mapErrorToViewState(result.error),
      submitError: result.error.message,
    }))

    return { ok: false as const, reason: result.error.kind }
  }

  const nextHash = createAssetStudioContentHash(runtime.getState(), exportResult.value.hash)

  runtime.setState((current) => ({
    ...current,
    viewState: 'submitSuccess',
    lastSubmittedHash: nextHash,
    submitError: undefined,
    toastVisible: true,
  }))

  return { ok: true as const, asset: result.value }
}

export function resetAssetStudio(runtime: AssetStudioControllerRuntime) {
  const form = createDefaultAssetStudioForm()
  const resetResult = runtime.drawingPort.reset(form.size)

  runtime.setState((state) => ({
    ...state,
    form,
    viewState: resetResult.ok ? 'default' : 'submitFailed',
    loadedSource: undefined,
    lastSubmittedHash: undefined,
    submitError: resetResult.ok ? undefined : resetResult.error.message,
    toastVisible: false,
  }))

  return resetResult.ok
    ? { ok: true as const }
    : { ok: false as const, reason: resetResult.error.kind }
}

export function openAssetStudioLoadModal(runtime: AssetStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    loadModalOpen: true,
    viewState: state.loadModalTab === 'mine' ? 'loadMine' : 'loadOthers',
  }))
}

export function closeAssetStudioLoadModal(runtime: AssetStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    loadModalOpen: false,
    viewState: 'default',
  }))
}

export function setAssetStudioLoadTab(
  runtime: AssetStudioControllerRuntime,
  tab: AssetLoadTab,
) {
  runtime.setState((state) => ({
    ...state,
    loadModalTab: tab,
    viewState: tab === 'mine' ? 'loadMine' : 'loadOthers',
  }))
}

export function createAssetStudioContentHash(
  state: Pick<AssetStudioControllerState, 'form'>,
  drawingHash: string,
) {
  return JSON.stringify({
    drawingHash,
    form: {
      ...state.form,
      name: state.form.name.trim(),
      description: state.form.description.trim(),
    },
  })
}

function createAssetStudioSubmitPayload(
  state: AssetStudioControllerState,
  session: LoginSession,
  image: string,
): AssetStudioSubmitPayload {
  return {
    userId: session.id,
    sessionToken: session.token,
    category: state.form.category,
    name: state.form.name.trim(),
    description: state.form.description.trim(),
    image,
    attrs: serializeAssetStudioAttrs(state.form.attrs),
    widthCells: state.form.size.widthCells,
    heightCells: state.form.size.heightCells,
    remixOfId: state.loadedSource?.assetId ?? null,
  }
}

function updateAssetStudioLayout(
  runtime: AssetStudioControllerRuntime,
  updater: (layout: AssetStudioLayoutValue) => AssetStudioLayoutValue,
) {
  const nextLayout = updater(runtime.getState().layout)

  runtime.layoutStorage.saveLayout(nextLayout)
  runtime.setState((state) => ({
    ...state,
    layout: nextLayout,
    viewState: nextLayout.resizing ? 'resizing' : state.viewState,
  }))
}

function resizeAssetStudioPanel(
  runtime: AssetStudioControllerRuntime,
  side: 'left' | 'right',
  delta: number,
) {
  updateAssetStudioLayout(runtime, (layout) => {
    if (side === 'left') {
      return {
        ...layout,
        leftPanelWidth: clampPanelWidth(layout.leftPanelWidth + delta),
        resizing: 'left',
      }
    }

    return {
      ...layout,
      rightPanelWidth: clampPanelWidth(layout.rightPanelWidth + delta),
      resizing: 'right',
    }
  })
}

function setAssetStudioTool(runtime: AssetStudioControllerRuntime, toolId: StudioToolId) {
  runtime.setState((state) => ({
    ...state,
    activeTool: toolId,
    toastVisible: false,
  }))
}

function setAssetStudioBrushSize(runtime: AssetStudioControllerRuntime, brushSize: number) {
  runtime.setState((state) => ({
    ...state,
    brushSize: brushSize === 2 || brushSize === 8 ? brushSize : 4,
  }))
}

function setAssetStudioOpacity(runtime: AssetStudioControllerRuntime, opacity: number) {
  runtime.setState((state) => ({
    ...state,
    opacity: Math.min(1, Math.max(0.1, opacity)),
  }))
}

function selectAssetStudioColor(runtime: AssetStudioControllerRuntime, swatchId: string) {
  runtime.setState((state) => ({
    ...state,
    selectedSwatchId: swatchId,
    recentSwatchIds: [swatchId, ...state.recentSwatchIds.filter((item) => item !== swatchId)].slice(0, 3),
  }))
}

function toggleAssetStudioChecker(runtime: AssetStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    checkerMode: state.checkerMode === 'light' ? 'dark' : 'light',
  }))
}

function toggleAssetStudioGrid(runtime: AssetStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    gridVisible: !state.gridVisible,
  }))
}

function clearAssetStudioCanvas(runtime: AssetStudioControllerRuntime) {
  const result = runtime.drawingPort.clear()

  runtime.setState((state) => ({
    ...state,
    viewState: result.ok ? (state.loadedSource ? 'loadedChanged' : 'default') : 'submitFailed',
    submitError: result.ok ? undefined : result.error.message,
    toastVisible: false,
  }))

  return result.ok
    ? { ok: true as const }
    : { ok: false as const, reason: result.error.kind }
}

function markAssetStudioChanged(runtime: AssetStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    viewState: state.loadedSource ? 'loadedChanged' : 'default',
    toastVisible: false,
  }))
}

function deriveAssetStudioScreenState(
  state: AssetStudioControllerState,
  dirtyState: AssetStudioScreenProps['dirtyState'],
): AssetStudioScreenState {
  if (state.viewState === 'submitting' || state.viewState === 'submitSuccess' || state.viewState === 'submitFailed') {
    return state.viewState
  }

  if (state.layout.leftCollapsed) {
    return 'leftCollapsed'
  }

  if (state.layout.rightCollapsed) {
    return 'rightCollapsed'
  }

  if (state.layout.resizing) {
    return 'resizing'
  }

  if (state.loadModalOpen) {
    return state.loadModalTab === 'mine' ? 'loadMine' : 'loadOthers'
  }

  if (state.form.name.trim().length === 0 && state.submitError) {
    return 'invalidMissingName'
  }

  if (state.loadedSource && dirtyState === 'unchanged') {
    return 'loadedUnchanged'
  }

  if (state.loadedSource && dirtyState === 'changed') {
    return 'loadedChanged'
  }

  return state.viewState === 'offline' ? 'offline' : state.viewState === 'sizeChanged' ? 'sizeChanged' : 'default'
}

function deriveDirtyState(
  state: AssetStudioControllerState,
  contentHash: string,
): AssetStudioScreenProps['dirtyState'] {
  if (state.lastSubmittedHash === contentHash && state.viewState === 'submitSuccess') {
    return 'submitted'
  }

  if (state.loadedSource && state.loadedSource.baselineHash === contentHash) {
    return 'unchanged'
  }

  if (state.form.name.trim().length === 0 && !state.loadedSource) {
    return 'blank'
  }

  return 'changed'
}

function deriveSubmitDisabledReason(
  state: AssetStudioControllerState,
  contentHash: string,
) {
  if (state.viewState === 'submitting') {
    return '요청 중입니다.'
  }

  if (state.form.name.trim().length === 0) {
    return '이름을 입력해 주세요.'
  }

  if (!isUserCreatableCategory(state.form.category)) {
    return '선택할 수 없는 카테고리입니다.'
  }

  if (state.loadedSource && state.loadedSource.baselineHash === contentHash) {
    return '불러온 에셋을 수정한 뒤 만들 수 있어요.'
  }

  if (state.lastSubmittedHash === contentHash) {
    return '이미 같은 내용으로 요청했어요. 새 에셋 만들기 또는 수정 후 다시 요청해 주세요.'
  }

  return undefined
}

function mapLoadableAssets(
  assets: AssetStudioAssetRecord[],
  tab: AssetLoadTab,
): AssetLoadItem[] {
  return assets
    .filter((asset) => (tab === 'mine' ? asset.isMine : !asset.isMine))
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      category: getCategoryLabel(asset.category),
      status: asset.status === 'ready' || asset.status === 'generating' ? asset.status : 'failed',
    }))
}

function serializeAssetStudioAttrs(attrs: AssetStudioAttrs) {
  return {
    behaviors: attrs.behaviors.join(','),
    collider: attrs.collider,
    motion: attrs.motion,
  }
}

function deserializeAssetStudioAttrs(attrs: Record<string, string | number | boolean | null>): AssetStudioAttrs {
  const behaviors = typeof attrs.behaviors === 'string'
    ? attrs.behaviors.split(',').filter(Boolean)
    : ['solid']
  const collider = attrs.collider === 'hazard' || attrs.collider === 'none' ? attrs.collider : 'solid'
  const motion = attrs.motion === 'moving' || attrs.motion === 'patrol' ? attrs.motion : 'static'

  return {
    behaviors: behaviors.length > 0 ? behaviors : ['solid'],
    collider,
    motion,
  }
}

function createDisabledToolIds(state: AssetStudioControllerState): StudioToolId[] {
  if (state.viewState === 'submitting') {
    return ['pen', 'eraser', 'eyedropper', 'move', 'undo', 'redo', 'clear']
  }

  return ['redo']
}

function normalizeAssetStudioSize(size: AssetStudioSize): AssetStudioSize {
  return {
    widthCells: clampCellCount(size.widthCells),
    heightCells: clampCellCount(size.heightCells),
  }
}

function clampCellCount(value: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(8, Math.max(1, Math.trunc(value)))
}

function clampPanelWidth(value: number) {
  return Math.min(420, Math.max(220, Math.trunc(value)))
}

function clampRatio(value: number) {
  return Math.min(0.8, Math.max(0.2, value))
}

function isUserCreatableCategory(category: AssetStudioCategory) {
  return category === 'platform' || category === 'obstacle' || category === 'monster' || category === 'background'
}

function mapErrorToViewState(error: AssetStudioControllerError): AssetStudioScreenState {
  if (error.kind === 'offline') {
    return 'offline'
  }

  return 'submitFailed'
}

function getCategoryLabel(category: AssetStudioCategory) {
  const labels: Record<AssetStudioCategory, string> = {
    platform: '플랫폼',
    obstacle: '장애물',
    monster: '몬스터',
    background: '배경',
  }

  return labels[category]
}
