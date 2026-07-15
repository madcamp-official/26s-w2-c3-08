import type { AssetLoadItem } from '../../design-system/studio'
import type {
  AvatarStudioCanvasImage,
  AvatarStudioFormValue,
  AvatarStudioLayoutValue,
  AvatarStudioScreenProps,
  AvatarStudioScreenState,
} from '../../pages/avatar-studio/AvatarStudioScreen'
import { getAvatarStudioPaletteSwatches } from '../../pages/avatar-studio/avatarStudioControllerCore'
import {
  recentPaletteSwatchIds,
  studioToolFixtures,
} from '../studio/studioFixtures'

export type AvatarStudioFixtureId =
  | 'a-avatar-studio-default'
  | 'a-avatar-studio-load-mine'
  | 'a-avatar-studio-loaded-unchanged'
  | 'a-avatar-studio-loaded-changed'
  | 'a-avatar-studio-invalid-name'
  | 'a-avatar-studio-submitting'
  | 'a-avatar-studio-submit-success'
  | 'a-avatar-studio-submit-failed'

export interface AvatarStudioScreenFixture {
  id: AvatarStudioFixtureId
  screenId: 'A_AVATAR_STUDIO'
  state: AvatarStudioScreenState
  viewport: '1280x720' | '1440x900' | '1920x1080'
  title: string
  description: string
  form: AvatarStudioFormValue
  layout: AvatarStudioLayoutValue
  activeTool?: AvatarStudioScreenProps['activeTool']
  checkerMode?: AvatarStudioScreenProps['checkerMode']
  gridVisible?: boolean
  dirtyState?: AvatarStudioScreenProps['dirtyState']
  submitDisabledReason?: string
  loadModalOpen?: boolean
  loadModalTab?: AvatarStudioScreenProps['loadModalTab']
  loadAvatarsLoading?: boolean
  toast?: AvatarStudioScreenProps['toast']
  submitError?: string
}

const defaultForm: AvatarStudioFormValue = {
  name: '릴레이러',
  description: '빠르게 달리는 아바타',
}

const defaultLayout: AvatarStudioLayoutValue = {
  leftCollapsed: false,
  rightCollapsed: false,
  leftPanelWidth: 292,
  rightPanelWidth: 320,
  resizing: null,
}

const fixtureCanvasImage = createFixtureCanvasImage()

export const avatarStudioLoadFixtures: AssetLoadItem[] = [
  { id: 'mine-avatar-ready', name: '달리기 아바타', category: '아바타', status: 'ready' },
  { id: 'other-avatar-ready', name: '친구 아바타', category: '아바타', status: 'ready' },
  { id: 'mine-avatar-failed', name: '실패한 아바타', category: '아바타', status: 'failed' },
]

export const avatarStudioScreenFixtures: AvatarStudioScreenFixture[] = [
  createFixture('a-avatar-studio-default', 'default', '기본 아바타 스튜디오'),
  createFixture('a-avatar-studio-load-mine', 'loadMine', '내 아바타 불러오기', {
    loadModalOpen: true,
    loadModalTab: 'mine',
  }),
  createFixture('a-avatar-studio-loaded-unchanged', 'loadedUnchanged', '불러온 아바타 수정 전', {
    dirtyState: 'unchanged',
    submitDisabledReason: '불러온 아바타를 수정한 뒤 저장할 수 있어요.',
  }),
  createFixture('a-avatar-studio-loaded-changed', 'loadedChanged', '불러온 아바타 수정 후', {
    dirtyState: 'changed',
  }),
  createFixture('a-avatar-studio-invalid-name', 'invalidName', '이름 오류', {
    form: { ...defaultForm, name: '' },
    submitDisabledReason: '아바타 이름을 입력해 주세요.',
  }),
  createFixture('a-avatar-studio-submitting', 'submitting', '저장 중', {
    dirtyState: 'changed',
  }),
  createFixture('a-avatar-studio-submit-success', 'submitSuccess', '저장 성공', {
    dirtyState: 'submitted',
    toast: {
      tone: 'success',
      title: '아바타를 저장했어요.',
      message: '메인 화면에서 새 아바타를 확인할 수 있습니다.',
    },
  }),
  createFixture('a-avatar-studio-submit-failed', 'submitFailed', '저장 실패', {
    submitError: '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.',
  }),
]

export function getAvatarStudioScreenFixture(id: string | undefined) {
  return (
    avatarStudioScreenFixtures.find((fixture) => fixture.id === id) ??
    avatarStudioScreenFixtures[0]
  )
}

export function toAvatarStudioScreenProps(
  fixture: AvatarStudioScreenFixture,
  callbacks: Partial<AvatarStudioScreenProps> = {},
): AvatarStudioScreenProps {
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
    swatches: getAvatarStudioPaletteSwatches(),
    selectedSwatchId: 'ink',
    recentSwatchIds: recentPaletteSwatchIds,
    canvasImage: fixtureCanvasImage,
    checkerMode: fixture.checkerMode ?? 'light',
    gridVisible: fixture.gridVisible ?? true,
    dirtyState: fixture.dirtyState ?? 'changed',
    submitDisabledReason: fixture.submitDisabledReason,
    loadModalOpen: fixture.loadModalOpen ?? false,
    loadModalTab: fixture.loadModalTab ?? 'mine',
    loadAvatars: avatarStudioLoadFixtures,
    loadAvatarsLoading: fixture.loadAvatarsLoading,
    toast: fixture.toast,
    submitError: fixture.submitError,
    onGoMain: noop,
    onOpenWarehouse: noop,
    onNewAvatar: noop,
    onToggleLeftPanel: noop,
    onToggleRightPanel: noop,
    onToolChange: noop,
    onBrushSizeChange: noop,
    onOpacityChange: noop,
    onSelectColor: noop,
    onDrawCanvasPoint: noop,
    onEraseCanvasPoint: noop,
    onSampleCanvasColor: noop,
    onToggleCheckerMode: noop,
    onToggleGrid: noop,
    onUndo: noop,
    onRedo: noop,
    onClear: noop,
    onOpenLoadModal: noop,
    onCloseLoadModal: noop,
    onLoadTabChange: noop,
    onSelectLoadAvatar: noop,
    onNameChange: noop,
    onDescriptionChange: noop,
    onSubmit: noop,
    onDismissToast: noop,
    ...callbacks,
  }
}

function createFixture(
  id: AvatarStudioFixtureId,
  state: AvatarStudioScreenState,
  title: string,
  overrides: Partial<AvatarStudioScreenFixture> = {},
): AvatarStudioScreenFixture {
  return {
    id,
    screenId: 'A_AVATAR_STUDIO',
    state,
    viewport: '1440x900',
    title,
    description: 'A Avatar Studio fixture',
    form: defaultForm,
    layout: defaultLayout,
    ...overrides,
  }
}

function noop() {
  return undefined
}

function createFixtureCanvasImage(): AvatarStudioCanvasImage {
  return {
    width: 256,
    height: 512,
    data: new Uint8ClampedArray(256 * 512 * 4),
  }
}
