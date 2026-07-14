import type { LoginDataMode, LoginSession, StoragePort } from '../login/loginControllerCore'
import type {
  MainAvatarViewModel,
  MainScreenCallbacks,
  MainScreenProps,
  MainScreenState,
  SettingsModalState,
  SettingsValues,
} from './MainScreen'

export interface MainControllerError {
  kind:
    | 'validation'
    | 'authentication'
    | 'not_found'
    | 'expired'
    | 'server_unavailable'
    | 'malformed_response'
  message: string
  retryable: boolean
}

export type MainResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: MainControllerError
    }

export interface MainSnapshot {
  avatar: MainAvatarViewModel
  assetSummary: MainScreenProps['assetSummary']
  mainState: MainScreenState
}

export interface AssetPort {
  loadMainSnapshot(session: LoginSession, dataMode: LoginDataMode): Promise<MainResult<MainSnapshot>>
}

export interface MainSessionPort {
  updateNickname(
    session: LoginSession,
    nickname: string,
    dataMode: LoginDataMode,
  ): Promise<MainResult<LoginSession>>
}

export interface DeviceLinkTicket {
  code: string
  expiresAtMs: number
}

export interface DeviceLinkPort {
  issueDeviceCode(
    session: LoginSession,
    dataMode: LoginDataMode,
  ): Promise<MainResult<DeviceLinkTicket>>
  consumeDeviceCode(code: string, dataMode: LoginDataMode): Promise<MainResult<LoginSession>>
}

export interface SettingsStoragePort {
  loadSettings(): SettingsValues
  saveSettings(values: SettingsValues): void
}

export interface MainRoutePort {
  navigateLogin(): void
  navigateLobby(): void
  navigateAssetStudio(): void
  navigateWarehouse(tab: 'avatar' | 'component'): void
}

export type SettingsControllerCallbacks = Pick<
  MainScreenCallbacks,
  | 'onOpenSettings'
  | 'onCloseSettings'
  | 'onChangeBgmVolume'
  | 'onChangeSfxVolume'
  | 'onToggleMute'
  | 'onChangeNickname'
  | 'onSaveNickname'
  | 'onIssueDeviceCode'
  | 'onChangeDeviceCode'
  | 'onConsumeDeviceCode'
>

export interface SettingsController extends SettingsControllerCallbacks {}

export interface MainControllerState {
  session: LoginSession | null
  nickname: string
  mainState: MainScreenState
  avatar: MainAvatarViewModel
  assetSummary: MainScreenProps['assetSummary']
  settingsOpen: boolean
  settingsState: SettingsModalState
  settingsValues: SettingsValues
}

export interface MainControllerRuntime {
  dataMode: LoginDataMode
  sessionStoragePort: StoragePort
  settingsStoragePort: SettingsStoragePort
  sessionPort: MainSessionPort
  assetPort: AssetPort
  deviceLinkPort: DeviceLinkPort
  routePort: MainRoutePort
  getState: () => MainControllerState
  setState: (updater: (state: MainControllerState) => MainControllerState) => void
}

export const defaultSettingsValues: SettingsValues = {
  bgmVolume: 70,
  sfxVolume: 82,
  muted: false,
  nickname: '릴레이러',
  issuedCode: undefined,
  deviceCodeInput: '',
}

export const defaultAssetSummary: MainScreenProps['assetSummary'] = {
  total: 0,
  ready: 0,
  working: 0,
  failed: 0,
}

export const systemAvatarViewModel: MainAvatarViewModel = {
  state: 'system',
  title: '기본 아바타 · 졸라맨',
  description: '아바타가 없어도 바로 게임을 시작할 수 있어요.',
  statusText: '사용 가능',
}

export function createInitialMainControllerState(
  settingsValues: SettingsValues = defaultSettingsValues,
): MainControllerState {
  return {
    session: null,
    nickname: settingsValues.nickname,
    mainState: 'systemAvatar',
    avatar: systemAvatarViewModel,
    assetSummary: defaultAssetSummary,
    settingsOpen: false,
    settingsState: 'default',
    settingsValues,
  }
}

export async function bootMainController(runtime: MainControllerRuntime) {
  const settingsValues = runtime.settingsStoragePort.loadSettings()
  const session = runtime.sessionStoragePort.loadSession()

  runtime.setState((state) => ({
    ...state,
    session,
    nickname: session?.nickname ?? settingsValues.nickname,
    settingsValues: {
      ...settingsValues,
      nickname: session?.nickname ?? settingsValues.nickname,
    },
  }))

  if (!session) {
    runtime.routePort.navigateLogin()
    return { destination: 'login' as const, reason: 'no_session' as const }
  }

  const snapshotResult = await runtime.assetPort.loadMainSnapshot(session, runtime.dataMode)

  if (!snapshotResult.ok) {
    runtime.setState((state) => ({
      ...state,
      session,
      nickname: session.nickname,
      mainState: 'systemAvatar',
      avatar: systemAvatarViewModel,
      assetSummary: defaultAssetSummary,
    }))

    return { destination: 'main' as const, reason: 'asset_error' as const }
  }

  runtime.setState((state) => ({
    ...state,
    session,
    nickname: session.nickname,
    mainState: snapshotResult.value.mainState,
    avatar: snapshotResult.value.avatar,
    assetSummary: snapshotResult.value.assetSummary,
  }))

  return { destination: 'main' as const, reason: 'loaded' as const }
}

export function createMainScreenProps(runtime: MainControllerRuntime): MainScreenProps {
  const state = runtime.getState()

  return {
    state: state.mainState,
    nickname: state.nickname,
    avatar: state.avatar,
    assetSummary: state.assetSummary,
    settingsOpen: state.settingsOpen,
    settingsState: state.settingsState,
    settingsValues: state.settingsValues,
    ...createMainScreenCallbacks(runtime),
  }
}

export function createMainScreenCallbacks(runtime: MainControllerRuntime): MainScreenCallbacks {
  const settingsController = createSettingsController(runtime)

  return {
    onNavigateLobby: () => runtime.routePort.navigateLobby(),
    onOpenAssetStudio: () => runtime.routePort.navigateAssetStudio(),
    onOpenWarehouse: (tab) => runtime.routePort.navigateWarehouse(tab),
    onDismissAssetToast: () => dismissAssetToast(runtime),
    ...settingsController,
  }
}

export function createSettingsController(runtime: MainControllerRuntime): SettingsController {
  return {
    onOpenSettings: () => openSettings(runtime),
    onCloseSettings: () => closeSettings(runtime),
    onChangeBgmVolume: (value) => updateSettings(runtime, { bgmVolume: clampVolume(value) }),
    onChangeSfxVolume: (value) => updateSettings(runtime, { sfxVolume: clampVolume(value) }),
    onToggleMute: (muted) => updateSettings(runtime, { muted }),
    onChangeNickname: (nickname) => updateSettings(runtime, { nickname }),
    onSaveNickname: (nickname) => {
      void saveNickname(runtime, nickname)
    },
    onIssueDeviceCode: () => {
      void issueDeviceCode(runtime)
    },
    onChangeDeviceCode: (deviceCodeInput) => updateSettings(runtime, { deviceCodeInput }),
    onConsumeDeviceCode: (code) => {
      void consumeDeviceCode(runtime, code)
    },
  }
}

export function openSettings(runtime: MainControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    settingsOpen: true,
    settingsState: 'default',
    mainState: 'settingsOpen',
  }))
}

export function closeSettings(runtime: MainControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    settingsOpen: false,
    settingsState: 'default',
    mainState: getMainStateFromAvatar(state.avatar.state),
  }))
}

export function dismissAssetToast(runtime: MainControllerRuntime) {
  runtime.setState((state) => ({
    ...state,
    mainState: getMainStateFromAvatar(state.avatar.state),
  }))
}

export function updateSettings(
  runtime: MainControllerRuntime,
  patch: Partial<SettingsValues>,
) {
  runtime.setState((state) => {
    const settingsValues = {
      ...state.settingsValues,
      ...patch,
    }

    runtime.settingsStoragePort.saveSettings(settingsValues)

    return {
      ...state,
      settingsValues,
    }
  })
}

export async function saveNickname(runtime: MainControllerRuntime, rawNickname: string) {
  const nickname = normalizeSettingsNickname(rawNickname)

  if (!isValidSettingsNickname(nickname)) {
    return { ok: false as const, reason: 'validation' as const }
  }

  const state = runtime.getState()

  if (!state.session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  runtime.setState((current) => ({ ...current, settingsState: 'submitting' }))

  const result = await runtime.sessionPort.updateNickname(state.session, nickname, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((current) => ({ ...current, settingsState: 'serverError' }))
    return { ok: false as const, reason: 'remote_error' as const }
  }

  runtime.sessionStoragePort.saveSession(result.value)
  updateSettings(runtime, { nickname: result.value.nickname })
  runtime.setState((current) => ({
    ...current,
    session: result.value,
    nickname: result.value.nickname,
    settingsState: 'default',
  }))

  return { ok: true as const, session: result.value }
}

export async function issueDeviceCode(runtime: MainControllerRuntime) {
  const state = runtime.getState()

  if (!state.session) {
    runtime.routePort.navigateLogin()
    return { ok: false as const, reason: 'no_session' as const }
  }

  runtime.setState((current) => ({ ...current, settingsState: 'issuing' }))

  const result = await runtime.deviceLinkPort.issueDeviceCode(state.session, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((current) => ({
      ...current,
      settingsState: mapDeviceErrorToSettingsState(result.error),
    }))
    return { ok: false as const, reason: result.error.kind }
  }

  runtime.setState((current) => ({
    ...current,
    settingsState: 'issued',
    settingsValues: {
      ...current.settingsValues,
      issuedCode: result.value.code,
    },
  }))

  return { ok: true as const, ticket: result.value }
}

export async function consumeDeviceCode(runtime: MainControllerRuntime, rawCode: string) {
  const code = rawCode.trim().toUpperCase()

  if (code.length === 0) {
    runtime.setState((state) => ({ ...state, settingsState: 'invalid' }))
    return { ok: false as const, reason: 'validation' as const }
  }

  runtime.setState((state) => ({ ...state, settingsState: 'submitting' }))

  const result = await runtime.deviceLinkPort.consumeDeviceCode(code, runtime.dataMode)

  if (!result.ok) {
    runtime.setState((state) => ({
      ...state,
      settingsState: mapDeviceErrorToSettingsState(result.error),
      settingsValues: {
        ...state.settingsValues,
        deviceCodeInput: code,
      },
    }))
    return { ok: false as const, reason: result.error.kind }
  }

  runtime.sessionStoragePort.saveSession(result.value)
  updateSettings(runtime, { nickname: result.value.nickname, deviceCodeInput: '' })
  runtime.setState((state) => ({
    ...state,
    session: result.value,
    nickname: result.value.nickname,
    settingsState: 'default',
  }))

  return { ok: true as const, session: result.value }
}

export function normalizeSettingsNickname(nickname: string) {
  return nickname.trim()
}

export function isValidSettingsNickname(nickname: string) {
  return nickname.length >= 1 && nickname.length <= 12
}

export function clampVolume(value: number) {
  if (Number.isNaN(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round(value)))
}

export function getMainStateFromAvatar(avatarState: MainAvatarViewModel['state']): MainScreenState {
  if (avatarState === 'generating') {
    return 'avatarGenerating'
  }

  if (avatarState === 'ready') {
    return 'avatarReady'
  }

  if (avatarState === 'failed') {
    return 'avatarFailed'
  }

  return 'systemAvatar'
}

function mapDeviceErrorToSettingsState(error: MainControllerError): SettingsModalState {
  if (error.kind === 'expired') {
    return 'expired'
  }

  if (error.kind === 'validation' || error.kind === 'not_found' || error.kind === 'authentication') {
    return 'invalid'
  }

  return 'serverError'
}
