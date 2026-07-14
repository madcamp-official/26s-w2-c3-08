import type {
  LoginControllerError,
  LoginResult,
  LoginSession,
  SessionPort,
} from '../../pages/login/loginControllerCore'

interface RemoteSessionPortOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

export function createRemoteSessionPort({
  baseUrl = '',
  fetcher = fetch,
}: RemoteSessionPortOptions = {}): SessionPort {
  return {
    async createSession(nickname) {
      return requestSession(fetcher, `${baseUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      })
    },
    async validateSession(session) {
      const result = await requestSession(fetcher, `${baseUrl}/api/session/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.token }),
      })

      if (!result.ok && result.error.kind === 'authentication') {
        return { ok: true, value: null }
      }

      return result
    },
  }
}

async function requestSession(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<LoginResult<LoginSession>> {
  let response: Response

  try {
    response = await fetcher(input, init)
  } catch {
    return {
      ok: false,
      error: createError('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.'),
    }
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return {
      ok: false,
      error: createError('authentication', '세션이 만료되었어요. 다시 시작해주세요.'),
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      error: createError('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.'),
    }
  }

  let body: unknown

  try {
    body = await response.json()
  } catch {
    return {
      ok: false,
      error: createError('malformed_response', '서버 응답 형식이 올바르지 않아요.'),
    }
  }

  const session = unwrapSession(body)

  if (!session) {
    return {
      ok: false,
      error: createError('malformed_response', '서버 응답 형식이 올바르지 않아요.'),
    }
  }

  return {
    ok: true,
    value: session,
  }
}

function unwrapSession(body: unknown): LoginSession | null {
  if (!isRecord(body)) {
    return null
  }

  const candidate =
    getRecord(body.session) ?? getRecord(body.data) ?? getRecord(body.user) ?? body

  if (
    typeof candidate.id === 'string' &&
    typeof candidate.nickname === 'string' &&
    typeof candidate.token === 'string'
  ) {
    return {
      id: candidate.id,
      nickname: candidate.nickname,
      token: candidate.token,
      avatarAssetId:
        typeof candidate.avatarAssetId === 'string' ? candidate.avatarAssetId : undefined,
    }
  }

  return null
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function createError(
  kind: LoginControllerError['kind'],
  message: string,
): LoginControllerError {
  return {
    kind,
    message,
    retryable: kind !== 'malformed_response',
  }
}
