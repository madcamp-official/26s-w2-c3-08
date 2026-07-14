import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  AssetPort,
  MainControllerError,
  MainResult,
  MainSnapshot,
} from '../../pages/main/mainControllerCore'

interface RemoteAssetPortOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

export function createRemoteAssetPort({
  baseUrl = '',
  fetcher = fetch,
}: RemoteAssetPortOptions = {}): AssetPort {
  return {
    async loadMainSnapshot(session) {
      return requestAssets(fetcher, `${baseUrl}/api/assets?user_id=${encodeURIComponent(session.id)}`, session)
    },
  }
}

async function requestAssets(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
): Promise<MainResult<MainSnapshot>> {
  let response: Response

  try {
    response = await fetcher(input, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    })
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

  const assets = unwrapAssets(body)

  if (!assets) {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.')
  }

  return {
    ok: true,
    value: summarizeAssets(assets, session),
  }
}

function unwrapAssets(body: unknown): Array<Record<string, unknown>> | null {
  if (!isRecord(body)) {
    return null
  }

  const candidate = Array.isArray(body.assets) ? body.assets : Array.isArray(body.data) ? body.data : null

  if (!candidate) {
    return null
  }

  return candidate.filter(isRecord)
}

function summarizeAssets(assets: Array<Record<string, unknown>>, session: LoginSession): MainSnapshot {
  const userAssets = assets.filter((asset) => asset.userId === session.id || asset.user_id === session.id)
  const avatarAsset = userAssets.find((asset) => asset.category === 'avatar' && asset.status === 'ready')
  const workingCount = userAssets.filter(
    (asset) => asset.status === 'queued' || asset.status === 'generating',
  ).length
  const failedCount = userAssets.filter((asset) => asset.status === 'failed').length
  const readyCount = userAssets.filter((asset) => asset.status === 'ready').length

  if (avatarAsset) {
    return {
      mainState: 'avatarReady',
      avatar: {
        state: 'ready',
        title: '장착한 아바타',
        description: '내 창고에서 다른 아바타로 바꿀 수 있어요.',
        statusText: '사용 가능',
      },
      assetSummary: {
        total: userAssets.length,
        ready: readyCount,
        working: workingCount,
        failed: failedCount,
      },
    }
  }

  return {
    mainState: 'systemAvatar',
    avatar: {
      state: 'system',
      title: '기본 아바타 · 졸라맨',
      description: '아바타가 없어도 바로 게임을 시작할 수 있어요.',
      statusText: '사용 가능',
    },
    assetSummary: {
      total: userAssets.length,
      ready: readyCount,
      working: workingCount,
      failed: failedCount,
    },
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
