import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  AssetPort,
  MainControllerError,
  MainResult,
  MainSnapshot,
} from '../../pages/main/mainControllerCore'
import {
  logMalformedResponse,
  type MalformedResponseReason,
} from '../diagnostics/malformedResponseLogger'

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
    return createMalformedFailure('main.loadAssets', input, 'invalid_json', undefined, response.status)
  }

  const assets = unwrapAssets(body)

  if (!assets) {
    return createMalformedFailure('main.loadAssets', input, 'unexpected_shape', body, response.status)
  }

  return {
    ok: true,
    value: summarizeAssets(assets, session),
  }
}

function createMalformedFailure(
  operation: string,
  input: RequestInfo | URL,
  reason: MalformedResponseReason,
  body?: unknown,
  status?: number,
): MainResult<never> {
  logMalformedResponse({
    source: 'api',
    adapter: 'remoteAssetPort',
    operation,
    reason,
    endpoint: input,
    status,
    body,
  })

  return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.')
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
  const userAssets = assets.filter((asset) => readAssetOwnerId(asset) === session.id)
  const equippedAvatarAsset = session.avatarAssetId
    ? userAssets.find((asset) => readString(asset.id) === session.avatarAssetId && readString(asset.category) === 'avatar')
    : undefined
  const readyAvatarAsset =
    readString(equippedAvatarAsset?.status) === 'ready'
      ? equippedAvatarAsset
      : findLatestAvatarByStatus(userAssets, ['ready'])
  const workingAvatarAsset =
    isAssetStatus(equippedAvatarAsset, ['queued', 'generating'])
      ? equippedAvatarAsset
      : findLatestAvatarByStatus(userAssets, ['queued', 'generating'])
  const failedAvatarAsset =
    isAssetStatus(equippedAvatarAsset, ['failed'])
      ? equippedAvatarAsset
      : findLatestAvatarByStatus(userAssets, ['failed'])
  const workingCount = userAssets.filter(
    (asset) => asset.status === 'queued' || asset.status === 'generating',
  ).length
  const failedCount = userAssets.filter((asset) => asset.status === 'failed').length
  const readyCount = userAssets.filter((asset) => asset.status === 'ready').length

  if (readyAvatarAsset) {
    return {
      mainState: 'avatarReady',
      avatar: {
        state: 'ready',
        title: '장착한 아바타',
        description: '내 창고에서 다른 아바타로 바꿀 수 있어요.',
        statusText: '사용 가능',
        sourceImageUrl: readAvatarSourceImageUrl(readyAvatarAsset),
      },
      assetSummary: {
        total: userAssets.length,
        ready: readyCount,
        working: workingCount,
        failed: failedCount,
      },
    }
  }

  if (workingAvatarAsset) {
    return {
      mainState: 'avatarGenerating',
      avatar: {
        state: 'generating',
        title: '아바타 생성 중',
        description: '방금 저장한 그림을 기준으로 준비하고 있어요.',
        statusText: '생성 중',
        sourceImageUrl: readAvatarSourceImageUrl(workingAvatarAsset),
        estimateText: '아바타 생성 중 · 잠시 후 창고에서 사용할 수 있어요.',
      },
      assetSummary: {
        total: userAssets.length,
        ready: readyCount,
        working: workingCount,
        failed: failedCount,
      },
    }
  }

  if (failedAvatarAsset) {
    return {
      mainState: 'avatarFailed',
      avatar: {
        state: 'failed',
        title: '아바타 생성 실패',
        description: '창고에서 실패한 아바타를 확인하고 다시 시도할 수 있어요.',
        statusText: '생성 실패',
        sourceImageUrl: readAvatarSourceImageUrl(failedAvatarAsset),
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

function readAssetOwnerId(asset: Record<string, unknown>) {
  return (
    readString(asset.creatorId) ??
    readString(asset.creator_id) ??
    readString(asset.userId) ??
    readString(asset.user_id)
  )
}

function findLatestAvatarByStatus(assets: Array<Record<string, unknown>>, statuses: string[]) {
  return assets
    .filter((asset) => readString(asset.category) === 'avatar' && isAssetStatus(asset, statuses))
    .sort((left, right) => readAssetCreatedAtMs(right) - readAssetCreatedAtMs(left))[0]
}

function isAssetStatus(asset: Record<string, unknown> | undefined, statuses: string[]) {
  const status = asset ? readString(asset.status) : undefined

  return status ? statuses.includes(status) : false
}

function readAvatarSourceImageUrl(asset: Record<string, unknown>) {
  return (
    readString(asset.sourceImageUrl) ??
    readString(asset.source_image_url) ??
    readString(asset.image) ??
    undefined
  )
}

function readAssetCreatedAtMs(asset: Record<string, unknown>) {
  const createdAt = readString(asset.createdAt) ?? readString(asset.created_at) ?? readString(asset.created)
  const timestamp = createdAt ? Date.parse(createdAt) : NaN

  return Number.isFinite(timestamp) ? timestamp : 0
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
