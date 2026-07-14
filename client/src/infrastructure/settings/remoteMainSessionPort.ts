import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  MainControllerError,
  MainResult,
  MainSessionPort,
} from '../../pages/main/mainControllerCore'

interface RemoteMainSessionPortOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

export function createRemoteMainSessionPort({
  baseUrl = '',
  fetcher = fetch,
}: RemoteMainSessionPortOptions = {}): MainSessionPort {
  return {
    async updateNickname(session, nickname) {
      return requestSession(fetcher, `${baseUrl}/api/session/nickname`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ token: session.token, nickname }),
      })
    },
  }
}

async function requestSession(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<MainResult<LoginSession>> {
  let response: Response

  try {
    response = await fetcher(input, init)
  } catch {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.')
  }

  if (!response.ok) {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.')
  }

  let body: unknown

  try {
    body = await response.json()
  } catch {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.')
  }

  const session = unwrapSession(body)

  if (!session) {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.')
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

  const candidate = getRecord(body.session) ?? getRecord(body.data) ?? body

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

function createFailure(
  kind: MainControllerError['kind'],
  message: string,
): MainResult<never> {
  return {
    ok: false,
    error: {
      kind,
      message,
      retryable: kind !== 'malformed_response',
    },
  }
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
