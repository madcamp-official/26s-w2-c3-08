import type {
  MainAvatarViewModel,
  MainScreenProps,
  MainScreenState,
  SettingsModalState,
  SettingsValues,
} from '../../pages/main/MainScreen'

export type MainFixtureScreenId = 'S2_MAIN' | 'S2C_SETTINGS_MODAL'
export type MainFixtureViewport = '1280x720' | '1440x900' | '1920x1080'

const fixtureAvatarImageUrl = 'data:image/gif;base64,R0lGODdhAQACAIAAAP////8AACwAAAAAAQACAAACAkQBADs='

export interface MainScreenFixture {
  id: string
  screenId: MainFixtureScreenId
  title: string
  description: string
  state: MainScreenState | SettingsModalState
  viewport: MainFixtureViewport
  mainState: MainScreenState
  nickname: string
  avatar: MainAvatarViewModel
  settingsOpen: boolean
  settingsState: SettingsModalState
  settingsValues: SettingsValues
  assetSummary: MainScreenProps['assetSummary']
}

const defaultSettingsValues: SettingsValues = {
  bgmVolume: 70,
  sfxVolume: 82,
  muted: false,
  nickname: '릴레이러',
  issuedCode: undefined,
  deviceCodeInput: '',
}

const defaultAssetSummary = {
  total: 6,
  ready: 4,
  working: 1,
  failed: 1,
}

const longFixtureNickname = '릴레이맵메이커장인'

const systemAvatar: MainAvatarViewModel = {
  state: 'system',
  title: '기본 아바타 · 졸라맨',
  description: '아바타가 없어도 바로 게임을 시작할 수 있어요.',
  statusText: '사용 가능',
}

const generatingAvatar: MainAvatarViewModel = {
  state: 'generating',
  title: '아바타 생성 중',
  description: '완료되면 창고와 메인에서 자동으로 확인할 수 있어요.',
  statusText: '생성 중',
  sourceImageUrl: fixtureAvatarImageUrl,
  estimateText: '아바타 생성 중 · 예상 2~4분',
}

const readyAvatar: MainAvatarViewModel = {
  state: 'ready',
  title: '장착한 아바타',
  description: '내 창고에서 다른 아바타로 바꿀 수 있어요.',
  statusText: '사용 가능',
  sourceImageUrl: fixtureAvatarImageUrl,
}

const failedAvatar: MainAvatarViewModel = {
  state: 'failed',
  title: '아바타 생성 실패',
  description: '창고에서 실패한 아바타를 확인하고 다시 시도할 수 있어요.',
  statusText: '생성 실패',
  sourceImageUrl: fixtureAvatarImageUrl,
}

export const mainScreenFixtures: MainScreenFixture[] = [
  createMainFixture({
    id: 's2-main-system-avatar',
    title: '메인 기본 아바타',
    description: '시스템 기본 아바타와 주요 CTA가 함께 보이는 상태입니다.',
    state: 'systemAvatar',
    mainState: 'systemAvatar',
    avatar: systemAvatar,
    viewport: '1280x720',
  }),
  createMainFixture({
    id: 's2-main-avatar-generating',
    title: '메인 아바타 생성 중',
    description: '아바타 생성 중 상태와 예상 시간을 표시합니다.',
    state: 'avatarGenerating',
    mainState: 'avatarGenerating',
    avatar: generatingAvatar,
    viewport: '1440x900',
  }),
  createMainFixture({
    id: 's2-main-avatar-ready',
    title: '메인 아바타 준비됨',
    description: '사용 가능한 장착 아바타가 있는 상태입니다.',
    state: 'avatarReady',
    mainState: 'avatarReady',
    avatar: readyAvatar,
    viewport: '1440x900',
  }),
  createMainFixture({
    id: 's2-main-avatar-failed',
    title: '메인 아바타 실패',
    description: '아바타 생성 실패 상태와 창고 진입 affordance를 표시합니다.',
    state: 'avatarFailed',
    mainState: 'avatarFailed',
    avatar: failedAvatar,
    viewport: '1280x720',
  }),
  createMainFixture({
    id: 's2-main-asset-toast',
    title: '메인 에셋 토스트',
    description: '에셋 생성 요청 후 창고 CTA 토스트가 표시되는 상태입니다.',
    state: 'assetToast',
    mainState: 'assetToast',
    avatar: readyAvatar,
    viewport: '1440x900',
  }),
  createMainFixture({
    id: 's2-main-settings-open',
    title: '메인 설정 열림',
    description: '메인 화면 위에 설정 모달이 열린 상태입니다.',
    state: 'settingsOpen',
    mainState: 'settingsOpen',
    avatar: readyAvatar,
    settingsOpen: true,
    viewport: '1440x900',
  }),
  createSettingsFixture({
    id: 's2c-settings-default',
    title: '설정 기본',
    description: '소리, 닉네임, 기기 연동 기본 상태입니다.',
    state: 'default',
  }),
  createSettingsFixture({
    id: 's2c-settings-issuing',
    title: '설정 코드 발급 중',
    description: '연동 코드 발급 loading 상태입니다.',
    state: 'issuing',
  }),
  createSettingsFixture({
    id: 's2c-settings-issued',
    title: '설정 코드 발급됨',
    description: '5분 유효한 연동 코드가 표시되는 상태입니다.',
    state: 'issued',
    settingsValues: { issuedCode: 'TIGER-3392' },
  }),
  createSettingsFixture({
    id: 's2c-settings-expired',
    title: '설정 코드 만료',
    description: '만료된 연동 코드 오류를 표시합니다.',
    state: 'expired',
    settingsValues: { issuedCode: 'TIGER-3392', deviceCodeInput: 'TIGER-3392' },
  }),
  createSettingsFixture({
    id: 's2c-settings-invalid',
    title: '설정 코드 오류',
    description: '사용할 수 없는 코드 오류를 표시합니다.',
    state: 'invalid',
    settingsValues: { deviceCodeInput: 'WRONG-0000' },
  }),
  createSettingsFixture({
    id: 's2c-settings-submitting',
    title: '설정 제출 중',
    description: '닉네임 저장 또는 코드 소비가 진행 중인 상태입니다.',
    state: 'submitting',
    settingsValues: { deviceCodeInput: 'TIGER-3392' },
  }),
  createSettingsFixture({
    id: 's2c-settings-server-error',
    title: '설정 서버 오류',
    description: '기기 연동 서버 오류를 표시합니다.',
    state: 'serverError',
    settingsValues: { deviceCodeInput: 'TIGER-3392' },
  }),
]

export type MainScreenFixtureId = (typeof mainScreenFixtures)[number]['id']

export function getMainScreenFixture(fixtureId: string | undefined) {
  return (
    mainScreenFixtures.find((fixture) => fixture.id === fixtureId) ?? mainScreenFixtures[0]
  )
}

export function toMainScreenProps(
  fixture: MainScreenFixture,
  callbacks: MainScreenCallbacks = createNoopMainScreenCallbacks(),
): MainScreenProps {
  return {
    state: fixture.mainState,
    nickname: fixture.nickname,
    avatar: fixture.avatar,
    assetSummary: fixture.assetSummary,
    settingsOpen: fixture.settingsOpen,
    settingsState: fixture.settingsState,
    settingsValues: fixture.settingsValues,
    ...callbacks,
  }
}

export function createNoopMainScreenCallbacks(): MainScreenCallbacks {
  return {
    onNavigateLobby: () => undefined,
    onOpenAssetStudio: () => undefined,
    onOpenWarehouse: () => undefined,
    onOpenSettings: () => undefined,
    onCloseSettings: () => undefined,
    onDismissAssetToast: () => undefined,
    onChangeBgmVolume: () => undefined,
    onChangeSfxVolume: () => undefined,
    onToggleMute: () => undefined,
    onChangeNickname: () => undefined,
    onSaveNickname: () => undefined,
    onIssueDeviceCode: () => undefined,
    onChangeDeviceCode: () => undefined,
    onConsumeDeviceCode: () => undefined,
  }
}

type MainFixtureInput = Omit<
  MainScreenFixture,
  'screenId' | 'nickname' | 'settingsState' | 'settingsValues' | 'settingsOpen' | 'assetSummary'
> & {
  settingsOpen?: boolean
}

type SettingsFixtureInput = {
  id: string
  title: string
  description: string
  state: SettingsModalState
  settingsValues?: Partial<SettingsValues>
}

function createMainFixture(input: MainFixtureInput): MainScreenFixture {
  return {
    screenId: 'S2_MAIN',
    nickname: longFixtureNickname,
    settingsState: 'default',
    settingsValues: defaultSettingsValues,
    settingsOpen: false,
    assetSummary: defaultAssetSummary,
    ...input,
  }
}

function createSettingsFixture(input: SettingsFixtureInput): MainScreenFixture {
  return {
    id: input.id,
    screenId: 'S2C_SETTINGS_MODAL',
    title: input.title,
    description: input.description,
    state: input.state,
    viewport: '1280x720',
    mainState: 'settingsOpen',
    nickname: longFixtureNickname,
    avatar: readyAvatar,
    settingsOpen: true,
    settingsState: input.state,
    settingsValues: {
      ...defaultSettingsValues,
      ...input.settingsValues,
    },
    assetSummary: defaultAssetSummary,
  }
}

type MainScreenCallbacks = Pick<
  MainScreenProps,
  | 'onNavigateLobby'
  | 'onOpenAssetStudio'
  | 'onOpenWarehouse'
  | 'onOpenSettings'
  | 'onCloseSettings'
  | 'onDismissAssetToast'
  | 'onChangeBgmVolume'
  | 'onChangeSfxVolume'
  | 'onToggleMute'
  | 'onChangeNickname'
  | 'onSaveNickname'
  | 'onIssueDeviceCode'
  | 'onChangeDeviceCode'
  | 'onConsumeDeviceCode'
>
