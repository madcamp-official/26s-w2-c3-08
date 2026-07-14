import type {
  LoginDataMode,
  LoginResult,
  LoginSession,
  SessionPort,
} from '../../pages/login/loginControllerCore'

export function createMockSessionPort(): SessionPort {
  return {
    async createSession(nickname, dataMode) {
      assertMockMode(dataMode)
      return {
        ok: true,
        value: createDeterministicMockSession(nickname),
      }
    },
    async validateSession(session, dataMode) {
      assertMockMode(dataMode)

      if (session.token.startsWith('mock-token-')) {
        return {
          ok: true,
          value: session,
        }
      }

      return {
        ok: true,
        value: null,
      }
    },
  }
}

export function createDeterministicMockSession(nickname: string): LoginSession {
  const normalizedNickname = nickname.trim()
  const slug = encodeURIComponent(normalizedNickname).replaceAll('%', '').toLowerCase()

  return {
    id: `mock-user-${slug}`,
    nickname: normalizedNickname,
    token: `mock-token-${slug}`,
  }
}

function assertMockMode(dataMode: LoginDataMode): LoginResult<never> | undefined {
  if (dataMode === 'mock') {
    return undefined
  }

  throw new Error('MockSessionPort cannot be used outside VITE_DATA_MODE=mock')
}
