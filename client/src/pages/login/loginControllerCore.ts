export type LoginDataMode = 'mock' | 'remote'

export type LoginViewState =
  | 'boot'
  | 'default'
  | 'emptyNickname'
  | 'tooLong'
  | 'submitting'
  | 'serverError'
  | 'expiredSession'

export interface LoginSession {
  id: string
  nickname: string
  token: string
  avatarAssetId?: string
}

export interface LoginControllerError {
  kind:
    | 'validation'
    | 'authentication'
    | 'offline'
    | 'server_unavailable'
    | 'malformed_response'
  message: string
  retryable: boolean
}

export type LoginResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: LoginControllerError
    }

export interface SessionPort {
  createSession(nickname: string, dataMode: LoginDataMode): Promise<LoginResult<LoginSession>>
  validateSession(
    session: LoginSession,
    dataMode: LoginDataMode,
  ): Promise<LoginResult<LoginSession | null>>
}

export interface StoragePort {
  loadSession(): LoginSession | null
  saveSession(session: LoginSession): void
  clearSession(): void
}

export interface LoginRoutePort {
  navigateMain(): void
}

export interface LoginControllerRuntime {
  dataMode: LoginDataMode
  sessionPort: SessionPort
  storagePort: StoragePort
  routePort: LoginRoutePort
  getCurrentState: () => LoginViewState
  setViewState: (state: LoginViewState) => void
  setNickname?: (nickname: string) => void
}

export interface LoginControllerFlowResult {
  destination: 'login' | 'main'
  state: LoginViewState
  reason:
    | 'no_session'
    | 'valid_session'
    | 'invalid_session'
    | 'validation'
    | 'success'
    | 'error'
    | 'duplicate'
}

export function normalizeNickname(nickname: string) {
  return nickname.trim()
}

export function validateNickname(nickname: string): LoginViewState | null {
  const normalizedNickname = normalizeNickname(nickname)

  if (normalizedNickname.length < 1) {
    return 'emptyNickname'
  }

  if (normalizedNickname.length > 12) {
    return 'tooLong'
  }

  return null
}

export function isLoginBusy(state: LoginViewState) {
  return state === 'boot' || state === 'submitting'
}

export function mapLoginErrorToViewState(error: LoginControllerError): LoginViewState {
  if (error.kind === 'authentication') {
    return 'expiredSession'
  }

  return 'serverError'
}

export async function bootLoginSession(
  runtime: LoginControllerRuntime,
): Promise<LoginControllerFlowResult> {
  runtime.setViewState('boot')

  const storedSession = runtime.storagePort.loadSession()

  if (!storedSession) {
    runtime.setViewState('default')
    return { destination: 'login', state: 'default', reason: 'no_session' }
  }

  const validation = await runtime.sessionPort.validateSession(storedSession, runtime.dataMode)

  if (validation.ok && validation.value) {
    runtime.storagePort.saveSession(validation.value)
    runtime.routePort.navigateMain()
    return { destination: 'main', state: 'default', reason: 'valid_session' }
  }

  if (validation.ok && validation.value === null) {
    runtime.storagePort.clearSession()
    runtime.setNickname?.('')
    runtime.setViewState('default')
    return { destination: 'login', state: 'default', reason: 'invalid_session' }
  }

  if (!validation.ok) {
    const errorState = mapLoginErrorToViewState(validation.error)
    runtime.setViewState(errorState)
    return { destination: 'login', state: errorState, reason: 'error' }
  }

  runtime.setViewState('default')
  return { destination: 'login', state: 'default', reason: 'invalid_session' }
}

export async function submitLoginNickname(
  runtime: LoginControllerRuntime,
  rawNickname: string,
): Promise<LoginControllerFlowResult> {
  if (isLoginBusy(runtime.getCurrentState())) {
    return {
      destination: 'login',
      state: runtime.getCurrentState(),
      reason: 'duplicate',
    }
  }

  const validationState = validateNickname(rawNickname)

  if (validationState) {
    runtime.setViewState(validationState)
    return { destination: 'login', state: validationState, reason: 'validation' }
  }

  const nickname = normalizeNickname(rawNickname)
  runtime.setNickname?.(nickname)
  runtime.setViewState('submitting')

  const result = await runtime.sessionPort.createSession(nickname, runtime.dataMode)

  if (result.ok) {
    runtime.storagePort.saveSession(result.value)
    runtime.routePort.navigateMain()
    return { destination: 'main', state: 'default', reason: 'success' }
  }

  const errorState = mapLoginErrorToViewState(result.error)
  runtime.setViewState(errorState)
  return { destination: 'login', state: errorState, reason: 'error' }
}
