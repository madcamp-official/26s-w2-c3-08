import type {
  AssetLoadItem,
  PaletteSwatchModel,
  StudioToolId,
  ToolButtonProps,
} from '../../design-system/studio'
import type { LoginDataMode, LoginSession, StoragePort } from '../login/loginControllerCore'
import type {
  AvatarStudioFormValue,
  AvatarStudioLayoutValue,
  AvatarStudioScreenProps,
  AvatarStudioScreenState,
} from './AvatarStudioScreen'

const avatarStudioToolModels: ToolButtonProps['tool'][] = [
  { id: 'pen', label: '펜', shortcut: 'P' },
  { id: 'eraser', label: '지우개', shortcut: 'E' },
  { id: 'eyedropper', label: '스포이드', shortcut: 'I' },
  { id: 'move', label: '전체 이동', shortcut: 'M' },
  { id: 'undo', label: '실행취소', shortcut: 'Z' },
  { id: 'redo', label: '다시실행', shortcut: 'Y' },
  { id: 'clear', label: '전체지우기' },
]

const avatarStudioPaletteSwatches: PaletteSwatchModel[] = [
  { id: 'transparent', name: '투명', value: 'transparent', transparent: true },
  { id: 'ink', name: '잉크', value: 'var(--semantic-color-text-primary)' },
  { id: 'yellow', name: '건설 노랑', value: 'var(--semantic-color-action-primary-background)' },
  { id: 'sky', name: '하늘 파랑', value: 'var(--semantic-color-status-generating)' },
  { id: 'green', name: '지형 초록', value: 'var(--semantic-color-status-success)' },
  { id: 'danger', name: '위험 빨강', value: 'var(--semantic-color-status-error)' },
]

const avatarStudioRecentSwatchIds = ['ink', 'yellow', 'sky']
const avatarStudioBrushSizePresets = [2, 4, 8]

export interface AvatarStudioControllerError {
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

export type AvatarStudioResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: AvatarStudioControllerError
    }

export interface AvatarStudioAssetRecord {
  id: string
  creatorId: string | null
  name: string
  description: string
  status: 'queued' | 'generating' | 'ready' | 'failed'
  sourceImageUrl?: string
  isMine: boolean
}

export interface AvatarStudioSubmitPayload {
  userId: string
  sessionToken: string
  name: string
  description: string
  image: string
  remixOfId?: string | null
}

export interface AvatarStudioAssetPort {
  listAvatarAssets(
    session: LoginSession,
    dataMode: LoginDataMode,
  ): Promise<AvatarStudioResult<AvatarStudioAssetRecord[]>>
  createAvatar(
    payload: AvatarStudioSubmitPayload,
    dataMode: LoginDataMode,
  ): Promise<AvatarStudioResult<AvatarStudioAssetRecord>>
}

export interface AvatarStudioDrawingPort {
  getHash(): string
  reset(): AvatarStudioResult<{ hash: string }>
  loadAvatarSource(asset: AvatarStudioAssetRecord): AvatarStudioResult<{ hash: string }>
  exportPng(): AvatarStudioResult<{ image: string; hash: string; width: number; height: number }>
  undo(): boolean
  redo(): boolean
  clear(): AvatarStudioResult<{ hash: string }>
}

export interface AvatarStudioLayoutStorage {
  loadLayout(): AvatarStudioLayoutValue
  saveLayout(layout: AvatarStudioLayoutValue): void
}

export interface AvatarStudioRoutePort {
  navigateLogin(): void
  navigateMain(): void
  navigateWarehouseAvatar(): void
}

export interface AvatarStudioControllerState {
  session: LoginSession | null
  viewState: AvatarStudioScreenState
  form: AvatarStudioFormValue
  layout: AvatarStudioLayoutValue
  activeTool: StudioToolId
  brushSize: number
  opacity: number
  selectedSwatchId: string
  recentSwatchIds: string[]
  checkerMode: 'light' | 'dark'
  gridVisible: boolean
  loadModalOpen: boolean
  loadModalTab: 'mine' | 'others'
  loadableAvatars: AvatarStudioAssetRecord[]
  loadAvatarsLoading: boolean
  loadedSource?: {
    assetId: string
    name: string
    baselineHash: string
  }
  lastSubmittedHash?: string
  submitError?: string
  toastVisible: boolean
}

export interface AvatarStudioControllerRuntime {
  dataMode: LoginDataMode
  sessionStoragePort: StoragePort
  layoutStorage: AvatarStudioLayoutStorage
  assetPort: AvatarStudioAssetPort
  drawingPort: AvatarStudioDrawingPort
  routePort: AvatarStudioRoutePort
  getState: () => AvatarStudioControllerState
  setState: (updater: (state: AvatarStudioControllerState) => AvatarStudioControllerState) => void
}

export interface AvatarStudioBootOptions {
  mode?: 'new' | 'edit' | 'remix'
  sourceAssetId?: string
}

export function createDefaultAvatarStudioForm(): AvatarStudioFormValue {
  return {
    name: '나의 아바타',
    description: '',
  }
}

export function createDefaultAvatarStudioLayout(): AvatarStudioLayoutValue {
  return {
    leftCollapsed: false,
    rightCollapsed: false,
    leftPanelWidth: 292,
    rightPanelWidth: 320,
    resizing: null,
  }
}

export function createInitialAvatarStudioControllerState(
  layout: AvatarStudioLayoutValue = createDefaultAvatarStudioLayout(),
): AvatarStudioControllerState {
  return {
    session: null,
    viewState: 'default',
    form: createDefaultAvatarStudioForm(),
    layout,
    activeTool: 'pen',
    brushSize: 4,
    opacity: 1,
    selectedSwatchId: 'ink',
    recentSwatchIds: avatarStudioRecentSwatchIds,
    checkerMode: 'light',
    gridVisible: true,
    loadModalOpen: false,
    loadModalTab: 'mine',
    loadableAvatars: [],
    loadAvatarsLoading: false,
    loadedSource: undefined,
    lastSubmittedHash: undefined,
    submitError: undefined,
    toastVisible: false,
  }
}

export async function bootAvatarStudioController(
  runtime: AvatarStudioControllerRuntime,
  options: AvatarStudioBootOptions = {},
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

  await refreshAvatarStudioLoadableAvatars(runtime)

  if (options.sourceAssetId) {
    const loadResult = loadAvatarStudioSource(runtime, options.sourceAssetId)

    return {
      destination: 'avatarStudio' as const,
      reason: loadResult.ok ? options.mode ?? 'edit' : loadResult.reason,
    }
  }

  return { destination: 'avatarStudio' as const, reason: 'loaded' as const }
}

export async function refreshAvatarStudioLoadableAvatars(runtime: AvatarStudioControllerRuntime) {
  const session = runtime.getState().session ?? runtime.sessionStoragePort.loadSession()

  if (!session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  runtime.setState((state) => ({
    ...state,
    session,
    loadAvatarsLoading: true,
  }))

  const result = await runtime.assetPort.listAvatarAssets(session, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((state) => ({
      ...state,
      viewState: mapErrorToViewState(result.error),
      loadAvatarsLoading: false,
      submitError: result.error.message,
    }))

    return { ok: false as const, reason: result.error.kind }
  }

  runtime.setState((state) => ({
    ...state,
    loadableAvatars: result.value,
    loadAvatarsLoading: false,
  }))

  return { ok: true as const, avatars: result.value }
}

export function createAvatarStudioScreenProps(
  runtime: AvatarStudioControllerRuntime,
): AvatarStudioScreenProps {
  const state = runtime.getState()
  const contentHash = createAvatarStudioContentHash(state, runtime.drawingPort.getHash())
  const dirtyState = deriveDirtyState(state, contentHash)

  return {
    state: deriveAvatarStudioScreenState(state, dirtyState),
    form: state.form,
    layout: state.layout,
    activeTool: state.activeTool,
    disabledToolIds: state.viewState === 'submitting' ? ['undo', 'redo', 'clear'] : ['redo'],
    tools: avatarStudioToolModels,
    brushSize: state.brushSize,
    brushSizePresets: avatarStudioBrushSizePresets,
    opacity: state.opacity,
    swatches: avatarStudioPaletteSwatches,
    selectedSwatchId: state.selectedSwatchId,
    recentSwatchIds: state.recentSwatchIds,
    checkerMode: state.checkerMode,
    gridVisible: state.gridVisible,
    dirtyState,
    sourceAvatarName: state.loadedSource?.name,
    submitDisabledReason: deriveSubmitDisabledReason(state, contentHash),
    loadModalOpen: state.loadModalOpen,
    loadModalTab: state.loadModalTab,
    loadAvatars: mapLoadableAvatars(state.loadableAvatars, state.loadModalTab),
    loadAvatarsLoading: state.loadAvatarsLoading,
    toast: state.toastVisible
      ? {
          tone: 'success',
          title: '아바타를 저장했어요.',
          message: '메인 화면에서 새 아바타를 확인할 수 있습니다.',
        }
      : undefined,
    submitError: state.submitError,
    ...createAvatarStudioCallbacks(runtime),
  }
}

export function createAvatarStudioCallbacks(
  runtime: AvatarStudioControllerRuntime,
): Pick<
  AvatarStudioScreenProps,
  | 'onGoMain'
  | 'onOpenWarehouse'
  | 'onNewAvatar'
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
  | 'onSelectLoadAvatar'
  | 'onNameChange'
  | 'onDescriptionChange'
  | 'onSubmit'
  | 'onDismissToast'
> {
  return {
    onGoMain: () => runtime.routePort.navigateMain(),
    onOpenWarehouse: () => runtime.routePort.navigateWarehouseAvatar(),
    onNewAvatar: () => resetAvatarStudio(runtime),
    onToggleLeftPanel: () => updateAvatarStudioLayout(runtime, (layout) => ({
      ...layout,
      leftCollapsed: !layout.leftCollapsed,
      resizing: null,
    })),
    onToggleRightPanel: () => updateAvatarStudioLayout(runtime, (layout) => ({
      ...layout,
      rightCollapsed: !layout.rightCollapsed,
      resizing: null,
    })),
    onResizePanel: (side, delta) => resizeAvatarStudioPanel(runtime, side, delta),
    onResizeToolBlock: (delta) => updateAvatarStudioLayout(runtime, (layout) => ({
      ...layout,
      resizing: 'tools',
      leftPanelWidth: clampPanelWidth(layout.leftPanelWidth + Math.round(delta * 10)),
    })),
    onToolChange: (toolId) => setAvatarStudioTool(runtime, toolId),
    onBrushSizeChange: (brushSize) => setAvatarStudioBrushSize(runtime, brushSize),
    onOpacityChange: (opacity) => setAvatarStudioOpacity(runtime, opacity),
    onSelectColor: (swatchId) => selectAvatarStudioColor(runtime, swatchId),
    onToggleCheckerMode: () => toggleAvatarStudioChecker(runtime),
    onToggleGrid: () => toggleAvatarStudioGrid(runtime),
    onUndo: () => {
      runtime.drawingPort.undo()
      markAvatarStudioChanged(runtime)
    },
    onRedo: () => {
      runtime.drawingPort.redo()
      markAvatarStudioChanged(runtime)
    },
    onClear: () => clearAvatarStudioCanvas(runtime),
    onOpenLoadModal: () => openAvatarStudioLoadModal(runtime),
    onCloseLoadModal: () => closeAvatarStudioLoadModal(runtime),
    onLoadTabChange: (tab) => setAvatarStudioLoadTab(runtime, tab),
    onSelectLoadAvatar: (assetId) => loadAvatarStudioSource(runtime, assetId),
    onNameChange: (name) => updateAvatarStudioForm(runtime, { name }),
    onDescriptionChange: (description) => updateAvatarStudioForm(runtime, { description }),
    onSubmit: () => {
      void submitAvatarStudio(runtime)
    },
    onDismissToast: () => runtime.setState((state) => ({ ...state, toastVisible: false })),
  }
}

export function updateAvatarStudioForm(
  runtime: AvatarStudioControllerRuntime,
  patch: Partial<AvatarStudioFormValue>,
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

export function loadAvatarStudioSource(
  runtime: AvatarStudioControllerRuntime,
  assetId: string,
) {
  const asset = runtime.getState().loadableAvatars.find((item) => item.id === assetId)

  if (!asset || asset.status !== 'ready') {
    return { ok: false as const, reason: 'not_found' as const }
  }

  const result = runtime.drawingPort.loadAvatarSource(asset)

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
    },
    loadedSource: {
      assetId: asset.id,
      name: asset.name,
      baselineHash: createAvatarStudioContentHash(
        {
          ...state,
          form: {
            name: asset.name,
            description: asset.description,
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

export async function submitAvatarStudio(runtime: AvatarStudioControllerRuntime) {
  const state = runtime.getState()
  const contentHash = createAvatarStudioContentHash(state, runtime.drawingPort.getHash())
  const disabledReason = deriveSubmitDisabledReason(state, contentHash)

  if (disabledReason) {
    runtime.setState((current) => ({
      ...current,
      viewState: state.form.name.trim().length === 0 || state.form.name.trim().length > 12 ? 'invalidName' : current.viewState,
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

  const result = await runtime.assetPort.createAvatar(
    createAvatarStudioSubmitPayload(state, session, exportResult.value.image),
    runtime.dataMode,
  )

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      viewState: mapErrorToViewState(result.error),
      submitError: result.error.message,
    }))

    return { ok: false as const, reason: result.error.kind }
  }

  runtime.setState((current) => ({
    ...current,
    viewState: 'submitSuccess',
    lastSubmittedHash: createAvatarStudioContentHash(runtime.getState(), exportResult.value.hash),
    submitError: undefined,
    toastVisible: true,
  }))
  runtime.routePort.navigateMain()

  return { ok: true as const, avatar: result.value }
}

export function resetAvatarStudio(runtime: AvatarStudioControllerRuntime) {
  const form = createDefaultAvatarStudioForm()
  const resetResult = runtime.drawingPort.reset()

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

export function openAvatarStudioLoadModal(runtime: AvatarStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    loadModalOpen: true,
    viewState: state.loadModalTab === 'mine' ? 'loadMine' : 'loadOthers',
  }))
}

export function closeAvatarStudioLoadModal(runtime: AvatarStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    loadModalOpen: false,
    viewState: 'default',
  }))
}

export function setAvatarStudioLoadTab(
  runtime: AvatarStudioControllerRuntime,
  tab: 'mine' | 'others',
) {
  runtime.setState((state) => ({
    ...state,
    loadModalTab: tab,
    viewState: tab === 'mine' ? 'loadMine' : 'loadOthers',
  }))
}

export function clearAvatarStudioCanvas(runtime: AvatarStudioControllerRuntime) {
  const result = runtime.drawingPort.clear()

  runtime.setState((state) => ({
    ...state,
    viewState: result.ok ? state.loadedSource ? 'loadedChanged' : 'default' : 'submitFailed',
    submitError: result.ok ? undefined : result.error.message,
    toastVisible: false,
  }))

  return result.ok
}

export function updateAvatarStudioLayout(
  runtime: AvatarStudioControllerRuntime,
  updater: (layout: AvatarStudioLayoutValue) => AvatarStudioLayoutValue,
) {
  runtime.setState((state) => {
    const layout = updater(state.layout)
    runtime.layoutStorage.saveLayout(layout)

    return {
      ...state,
      layout,
      viewState: layout.resizing ? 'default' : state.viewState,
    }
  })
}

export function resizeAvatarStudioPanel(
  runtime: AvatarStudioControllerRuntime,
  side: 'left' | 'right',
  delta: number,
) {
  updateAvatarStudioLayout(runtime, (layout) => ({
    ...layout,
    leftPanelWidth: side === 'left' ? clampPanelWidth(layout.leftPanelWidth + delta) : layout.leftPanelWidth,
    rightPanelWidth: side === 'right' ? clampPanelWidth(layout.rightPanelWidth + delta) : layout.rightPanelWidth,
    resizing: side,
  }))
}

function setAvatarStudioTool(runtime: AvatarStudioControllerRuntime, toolId: StudioToolId) {
  runtime.setState((state) => ({
    ...state,
    activeTool: toolId,
  }))
}

function setAvatarStudioBrushSize(runtime: AvatarStudioControllerRuntime, brushSize: number) {
  runtime.setState((state) => ({
    ...state,
    brushSize: clampNumber(Math.round(brushSize), 2, 8),
  }))
}

function setAvatarStudioOpacity(runtime: AvatarStudioControllerRuntime, opacity: number) {
  runtime.setState((state) => ({
    ...state,
    opacity: clampNumber(opacity, 0.1, 1),
  }))
}

function selectAvatarStudioColor(runtime: AvatarStudioControllerRuntime, swatchId: string) {
  runtime.setState((state) => ({
    ...state,
    selectedSwatchId: swatchId,
    recentSwatchIds: [swatchId, ...state.recentSwatchIds.filter((id) => id !== swatchId)].slice(0, 3),
  }))
}

function toggleAvatarStudioChecker(runtime: AvatarStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    checkerMode: state.checkerMode === 'light' ? 'dark' : 'light',
  }))
}

function toggleAvatarStudioGrid(runtime: AvatarStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    gridVisible: !state.gridVisible,
  }))
}

function markAvatarStudioChanged(runtime: AvatarStudioControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    viewState: state.loadedSource ? 'loadedChanged' : 'default',
    submitError: undefined,
    toastVisible: false,
  }))
}

function createAvatarStudioSubmitPayload(
  state: AvatarStudioControllerState,
  session: LoginSession,
  image: string,
): AvatarStudioSubmitPayload {
  return {
    userId: session.id,
    sessionToken: session.token,
    name: state.form.name.trim(),
    description: state.form.description.trim(),
    image,
    remixOfId: state.loadedSource?.assetId ?? null,
  }
}

function createAvatarStudioContentHash(
  state: Pick<AvatarStudioControllerState, 'form'>,
  drawingHash: string,
) {
  return JSON.stringify({
    name: state.form.name.trim(),
    description: state.form.description.trim(),
    drawingHash,
  })
}

function deriveDirtyState(
  state: AvatarStudioControllerState,
  contentHash: string,
): AvatarStudioScreenProps['dirtyState'] {
  if (state.loadedSource?.baselineHash === contentHash) {
    return 'unchanged'
  }

  if (state.lastSubmittedHash === contentHash) {
    return 'submitted'
  }

  return 'changed'
}

function deriveAvatarStudioScreenState(
  state: AvatarStudioControllerState,
  dirtyState: AvatarStudioScreenProps['dirtyState'],
): AvatarStudioScreenState {
  if (state.viewState === 'loadedUnchanged' && dirtyState !== 'unchanged') {
    return 'loadedChanged'
  }

  return state.viewState
}

function deriveSubmitDisabledReason(
  state: AvatarStudioControllerState,
  contentHash: string,
) {
  const name = state.form.name.trim()

  if (name.length === 0) {
    return '아바타 이름을 입력해 주세요.'
  }

  if (name.length > 12) {
    return '아바타 이름은 12자까지 입력할 수 있어요.'
  }

  if (state.loadedSource?.baselineHash === contentHash) {
    return '불러온 아바타를 수정한 뒤 저장할 수 있어요.'
  }

  if (state.lastSubmittedHash === contentHash) {
    return '이미 저장한 내용입니다.'
  }

  return undefined
}

function mapLoadableAvatars(
  avatars: AvatarStudioAssetRecord[],
  tab: 'mine' | 'others',
): AssetLoadItem[] {
  return avatars
    .filter((avatar) => (tab === 'mine' ? avatar.isMine : !avatar.isMine))
    .map((avatar) => ({
      id: avatar.id,
      name: avatar.name,
      category: '아바타',
      status: avatar.status === 'queued' ? 'generating' : avatar.status,
    }))
}

function mapErrorToViewState(error: AvatarStudioControllerError): AvatarStudioScreenState {
  if (error.kind === 'offline' || error.kind === 'server_unavailable') {
    return 'offline'
  }

  return 'submitFailed'
}

function clampPanelWidth(value: number) {
  return clampNumber(Math.round(value), 220, 420)
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
