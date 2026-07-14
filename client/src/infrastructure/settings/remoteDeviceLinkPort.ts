import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  DeviceLinkPort,
  DeviceLinkTicket,
  MainControllerError,
  MainResult,
} from '../../pages/main/mainControllerCore'

interface RemoteDeviceLinkPortOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

export function createRemoteDeviceLinkPort({
  baseUrl = '',
  fetcher = fetch,
}: RemoteDeviceLinkPortOptions = {}): DeviceLinkPort {
  return {
    async issueDeviceCode(session) {
      return requestTicket(fetcher, `${baseUrl}/api/device-link-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ user_id: session.id }),
      })
    },
    async consumeDeviceCode(code) {
      return requestSession(fetcher, `${baseUrl}/api/device-link-codes/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
    },
  }
}

async function requestTicket(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<MainResult<DeviceLinkTicket>> {
  const responseResult = await requestJson(fetcher, input, init)

  if (!responseResult.ok) {
    return responseResult
  }

  const ticket = unwrapTicket(responseResult.value)

  if (!ticket) {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.')
  }

  return { ok: true, value: ticket }
}

async function requestSession(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<MainResult<LoginSession>> {
  const responseResult = await requestJson(fetcher, input, init)

  if (!responseResult.ok) {
    return responseResult
  }

  const session = unwrapSession(responseResult.value)

  if (!session) {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.')
  }

  return { ok: true, value: session }
}

async function requestJson(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<MainResult<unknown>> {
  let response: Response

  try {
    response = await fetcher(input, init)
  } catch {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.')
  }

  if (response.status === 404) {
    return createFailure('not_found', '사용할 수 없는 코드예요.')
  }

  if (response.status === 410) {
    return createFailure('expired', '만료된 코드예요. 새 코드를 발급해주세요.')
  }

  if (!response.ok) {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.')
  }

  try {
    return {
      ok: true,
      value: await response.json(),
    }
  } catch {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.')
  }
}

function unwrapTicket(body: unknown): DeviceLinkTicket | null {
  if (!isRecord(body)) {
    return null
  }

  const candidate = getRecord(body.ticket) ?? getRecord(body.data) ?? body

  if (typeof candidate.code === 'string') {
    return {
      code: candidate.code,
      expiresAtMs:
        typeof candidate.expiresAt === 'string'
          ? Date.parse(candidate.expiresAt)
          : Date.now() + 5 * 60 * 1000,
    }
  }

  return null
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
