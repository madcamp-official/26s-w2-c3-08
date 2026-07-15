import type { AssetLoadItem } from '../../design-system/studio'
import type {
  AssetStudioFormValue,
  AssetStudioLayoutValue,
  AssetStudioScreenProps,
  AssetStudioScreenState,
} from '../../pages/asset-studio/AssetStudioScreen'
import {
  paletteSwatches,
  recentPaletteSwatchIds,
  studioToolFixtures,
} from '../studio/studioFixtures'

export type AssetStudioFixtureId =
  | 'b-asset-studio-default'
  | 'b-asset-studio-left-collapsed'
  | 'b-asset-studio-right-collapsed'
  | 'b-asset-studio-resizing'
  | 'b-asset-studio-size-changed'
  | 'b-asset-studio-load-mine'
  | 'b-asset-studio-load-others'
  | 'b-asset-studio-loaded-unchanged'
  | 'b-asset-studio-loaded-changed'
  | 'b-asset-studio-invalid-missing-name'
  | 'b-asset-studio-submitting'
  | 'b-asset-studio-submit-success'
  | 'b-asset-studio-submit-failed'

export interface AssetStudioScreenFixture {
  id: AssetStudioFixtureId
  screenId: 'B_ASSET_STUDIO'
  state: AssetStudioScreenState
  viewport: '1280x720' | '1440x900' | '1920x1080'
  title: string
  description: string
  form: AssetStudioFormValue
  layout: AssetStudioLayoutValue
  activeTool?: AssetStudioScreenProps['activeTool']
  checkerMode?: AssetStudioScreenProps['checkerMode']
  gridVisible?: boolean
  dirtyState?: AssetStudioScreenProps['dirtyState']
  submitDisabledReason?: string
  loadModalOpen?: boolean
  loadModalTab?: AssetStudioScreenProps['loadModalTab']
  loadAssetsLoading?: boolean
  toast?: AssetStudioScreenProps['toast']
  submitError?: string
}

const defaultForm: AssetStudioFormValue = {
  name: '구름 발판',
  description: '점프 구간에 쓰는 폭신한 플랫폼',
  category: 'platform',
  size: { widthCells: 2, heightCells: 1 },
  attrs: {
    behaviors: ['solid'],
    collider: 'solid',
    motion: 'static',
  },
}

const defaultLayout: AssetStudioLayoutValue = {
  leftCollapsed: false,
  rightCollapsed: false,
  leftPanelWidth: 292,
  rightPanelWidth: 340,
  resizing: null,
}

export const assetStudioLoadFixtures: AssetLoadItem[] = [
  { id: 'mine-platform-ready', name: '튼튼한 발판 원본', category: '플랫폼', status: 'ready' },
  { id: 'mine-monster-ready', name: '순찰 로봇', category: '몬스터', status: 'ready' },
  { id: 'other-background-ready', name: '남이 만든 노을 배경', category: '배경', status: 'ready' },
  { id: 'other-obstacle-failed', name: '실패한 가시 게이트', category: '장애물', status: 'failed' },
]

export const assetStudioScreenFixtures: AssetStudioScreenFixture[] = [
  createFixture('b-asset-studio-default', 'default', '기본 에셋 스튜디오'),
  createFixture('b-asset-studio-left-collapsed', 'leftCollapsed', '왼쪽 패널 접힘', {
    layout: { ...defaultLayout, leftCollapsed: true },
  }),
  createFixture('b-asset-studio-right-collapsed', 'rightCollapsed', '오른쪽 패널 접힘', {
    layout: { ...defaultLayout, rightCollapsed: true },
  }),
  createFixture('b-asset-studio-resizing', 'resizing', '패널 리사이즈', {
    layout: { ...defaultLayout, resizing: 'left', leftPanelWidth: 324 },
  }),
  createFixture('b-asset-studio-size-changed', 'sizeChanged', '크기 변경과 리샘플', {
    form: { ...defaultForm, size: { widthCells: 4, heightCells: 2 } },
    dirtyState: 'changed',
  }),
  createFixture('b-asset-studio-load-mine', 'loadMine', '내 에셋 불러오기', {
    loadModalOpen: true,
    loadModalTab: 'mine',
  }),
  createFixture('b-asset-studio-load-others', 'loadOthers', '남이 만든 에셋 불러오기', {
    loadModalOpen: true,
    loadModalTab: 'others',
  }),
  createFixture('b-asset-studio-loaded-unchanged', 'loadedUnchanged', '불러온 원본 수정 전', {
    dirtyState: 'unchanged',
    submitDisabledReason: '불러온 에셋을 수정한 뒤 만들 수 있어요.',
  }),
  createFixture('b-asset-studio-loaded-changed', 'loadedChanged', '불러온 원본 수정 후', {
    dirtyState: 'changed',
  }),
  createFixture('b-asset-studio-invalid-missing-name', 'invalidMissingName', '이름 누락', {
    form: { ...defaultForm, name: '' },
    submitDisabledReason: '이름을 입력해 주세요.',
  }),
  createFixture('b-asset-studio-submitting', 'submitting', '제출 중', {
    dirtyState: 'changed',
  }),
  createFixture('b-asset-studio-submit-success', 'submitSuccess', '제출 성공 toast', {
    dirtyState: 'submitted',
    toast: {
      tone: 'success',
      title: '에셋 생성을 요청했어요.',
      message: '창고에서 진행 상황을 볼 수 있습니다.',
      actionLabel: '창고에서 진행 상황 보기',
    },
  }),
  createFixture('b-asset-studio-submit-failed', 'submitFailed', '제출 실패', {
    submitError: '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.',
  }),
]

export function getAssetStudioScreenFixture(id: string | undefined) {
  return (
    assetStudioScreenFixtures.find((fixture) => fixture.id === id) ??
    assetStudioScreenFixtures[0]
  )
}

export function getAssetStudioScreenFixtureByState(state: string) {
  return (
    assetStudioScreenFixtures.find((fixture) => fixture.state === state) ??
    assetStudioScreenFixtures[0]
  )
}

export function toAssetStudioScreenProps(
  fixture: AssetStudioScreenFixture,
  callbacks: Partial<AssetStudioScreenProps> = {},
): AssetStudioScreenProps {
  return {
    state: fixture.state,
    form: fixture.form,
    layout: fixture.layout,
    activeTool: fixture.activeTool ?? 'pen',
    disabledToolIds: fixture.state === 'submitting' ? ['undo', 'redo', 'clear'] : ['redo'],
    tools: studioToolFixtures,
    brushSize: 4,
    brushSizePresets: [2, 4, 8],
    opacity: 1,
    swatches: paletteSwatches,
    selectedSwatchId: 'yellow',
    recentSwatchIds: recentPaletteSwatchIds,
    checkerMode: fixture.checkerMode ?? 'light',
    gridVisible: fixture.gridVisible ?? true,
    dirtyState: fixture.dirtyState ?? 'changed',
    submitDisabledReason: fixture.submitDisabledReason,
    loadModalOpen: fixture.loadModalOpen ?? false,
    loadModalTab: fixture.loadModalTab ?? 'mine',
    loadAssets: assetStudioLoadFixtures,
    loadAssetsLoading: fixture.loadAssetsLoading,
    toast: fixture.toast,
    submitError: fixture.submitError,
    onGoMain: noop,
    onOpenWarehouse: noop,
    onNewAsset: noop,
    onToggleLeftPanel: noop,
    onToggleRightPanel: noop,
    onToolChange: noop,
    onBrushSizeChange: noop,
    onOpacityChange: noop,
    onSelectColor: noop,
    onToggleCheckerMode: noop,
    onToggleGrid: noop,
    onUndo: noop,
    onRedo: noop,
    onClear: noop,
    onOpenLoadModal: noop,
    onCloseLoadModal: noop,
    onLoadTabChange: noop,
    onSelectLoadAsset: noop,
    onNameChange: noop,
    onDescriptionChange: noop,
    onCategoryChange: noop,
    onSizeChange: noop,
    onAttrsChange: noop,
    onSubmit: noop,
    onDismissToast: noop,
    ...callbacks,
  }
}

function createFixture(
  id: AssetStudioFixtureId,
  state: AssetStudioScreenState,
  title: string,
  overrides: Partial<AssetStudioScreenFixture> = {},
): AssetStudioScreenFixture {
  return {
    id,
    screenId: 'B_ASSET_STUDIO',
    state,
    viewport: '1440x900',
    title,
    description: 'B Asset Studio fixture',
    form: defaultForm,
    layout: defaultLayout,
    ...overrides,
  }
}

function noop() {
  return undefined
}
