import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  WarehouseAssetCategory,
  WarehouseReviewAction,
} from '../../pages/warehouse/WarehouseScreen'
import type {
  WarehouseAssetPort,
  WarehouseAssetRecord,
  WarehouseAssetSpriteRecord,
  WarehouseControllerError,
  WarehouseResult,
} from '../../pages/warehouse/warehouseControllerCore'
import {
  logMalformedResponse,
  type MalformedResponseReason,
} from '../diagnostics/malformedResponseLogger'

interface RemoteWarehouseAssetPortOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

export function createRemoteWarehouseAssetPort({
  baseUrl = '',
  fetcher = fetch,
}: RemoteWarehouseAssetPortOptions = {}): WarehouseAssetPort {
  return {
    async listAssets(session) {
      return requestAssets(fetcher, `${baseUrl}/api/assets?user_id=${encodeURIComponent(session.id)}`, session)
    },
    async equipAvatar(session, assetId) {
      return requestSession(fetcher, `${baseUrl}/api/assets/${encodeURIComponent(assetId)}/equip-avatar`, session, 'warehouse.equipAvatar', {
        method: 'POST',
        body: JSON.stringify({ user_id: session.id }),
      })
    },
    async retryAsset(session, assetId) {
      return requestAsset(fetcher, `${baseUrl}/api/assets/${encodeURIComponent(assetId)}/retry`, session, 'warehouse.retryAsset', {
        method: 'POST',
        body: JSON.stringify({ user_id: session.id }),
      })
    },
    async regenerateAction(session, assetId, action) {
      return requestAsset(
        fetcher,
        `${baseUrl}/api/assets/${encodeURIComponent(assetId)}/sprites/${encodeURIComponent(action)}/regenerate`,
        session,
        'warehouse.regenerateAction',
        {
          method: 'POST',
          body: JSON.stringify({ user_id: session.id }),
        },
      )
    },
  }
}

async function requestAssets(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
): Promise<WarehouseResult<WarehouseAssetRecord[]>> {
  let response: Response

  try {
    response = await fetcher(input, {
      headers: createHeaders(session),
    })
  } catch {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', true)
  }

  if (!response.ok) {
    return mapHttpError(response.status, await readJsonSafely(response))
  }

  let body: unknown

  try {
    body = await response.json()
  } catch {
    return createMalformedFailure('warehouse.listAssets', input, 'invalid_json', undefined, response.status)
  }

  const assets = unwrapAssets(body)

  if (!assets) {
    return createMalformedFailure('warehouse.listAssets', input, 'unexpected_shape', body, response.status)
  }

  const normalizedAssets = normalizeAssetList(assets, session)

  if (!normalizedAssets) {
    return createMalformedFailure('warehouse.listAssets', input, 'unexpected_shape', body, response.status)
  }

  return {
    ok: true,
    value: normalizedAssets,
  }
}

async function requestSession(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
  operation: string,
  init: RequestInit,
): Promise<WarehouseResult<LoginSession>> {
  const responseResult = await requestJson(fetcher, input, session, operation, init)

  if (!responseResult.ok) {
    return responseResult
  }

  const nextSession = unwrapSession(responseResult.value)

  return nextSession
    ? { ok: true, value: nextSession }
    : createMalformedFailure(operation, input, 'unexpected_shape', responseResult.value)
}

async function requestAsset(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
  operation: string,
  init: RequestInit,
): Promise<WarehouseResult<WarehouseAssetRecord>> {
  const responseResult = await requestJson(fetcher, input, session, operation, init)

  if (!responseResult.ok) {
    return responseResult
  }

  const record = unwrapAsset(responseResult.value)
  const normalizedAsset = record ? normalizeAsset(record, session) : null

  return normalizedAsset
    ? { ok: true, value: normalizedAsset }
    : createMalformedFailure(operation, input, 'unexpected_shape', responseResult.value)
}

async function requestJson(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
  operation: string,
  init: RequestInit,
): Promise<WarehouseResult<unknown>> {
  let response: Response

  try {
    response = await fetcher(input, {
      ...init,
      headers: {
        ...createHeaders(session),
        ...init.headers,
      },
    })
  } catch {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', true)
  }

  let body: unknown

  try {
    body = await response.json()
  } catch {
    if (!response.ok) {
      return mapHttpError(response.status, null)
    }

    return createMalformedFailure(operation, input, 'invalid_json', undefined, response.status)
  }

  if (!response.ok) {
    return mapHttpError(response.status, body)
  }

  return { ok: true, value: body }
}

function createMalformedFailure<T>(
  operation: string,
  input: RequestInfo | URL,
  reason: MalformedResponseReason,
  body?: unknown,
  status?: number,
): WarehouseResult<T> {
  logMalformedResponse({
    source: 'api',
    adapter: 'remoteWarehouseAssetPort',
    operation,
    reason,
    endpoint: input,
    status,
    body,
  })

  return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function unwrapAssets(body: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(body)) {
    return body.filter(isRecord)
  }

  if (!isRecord(body)) {
    return null
  }

  const candidate = Array.isArray(body.assets) ? body.assets : Array.isArray(body.data) ? body.data : null

  return candidate ? candidate.filter(isRecord) : null
}

function unwrapAsset(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) {
    return null
  }

  const candidate = isRecord(body.asset) ? body.asset : isRecord(body.data) ? body.data : body

  return isRecord(candidate) ? candidate : null
}

function unwrapSession(body: unknown): LoginSession | null {
  if (!isRecord(body)) {
    return null
  }

  const candidate = isRecord(body.session) ? body.session : isRecord(body.data) ? body.data : body

  if (
    typeof candidate.id === 'string' &&
    typeof candidate.nickname === 'string' &&
    typeof candidate.token === 'string'
  ) {
    return {
      id: candidate.id,
      nickname: candidate.nickname,
      token: candidate.token,
      avatarAssetId: typeof candidate.avatarAssetId === 'string' ? candidate.avatarAssetId : undefined,
    }
  }

  return null
}

function normalizeAssetList(
  assets: Array<Record<string, unknown>>,
  session: LoginSession,
): WarehouseAssetRecord[] | null {
  const normalizedAssets: WarehouseAssetRecord[] = []

  for (const asset of assets) {
    const normalizedAsset = normalizeAsset(asset, session)

    if (!normalizedAsset) {
      return null
    }

    normalizedAssets.push(normalizedAsset)
  }

  return normalizedAssets
}

function normalizeAsset(
  asset: Record<string, unknown>,
  session: LoginSession,
): WarehouseAssetRecord | null {
  const id = readString(asset.id)
  const name = readString(asset.name) ?? readString(asset.title)
  const category = normalizeCategory(readString(asset.category))
  const status = normalizeStatus(readString(asset.status))

  if (!id || !name || !category || !status) {
    return null
  }

  const createdAt =
    readString(asset.createdAt) ??
    readString(asset.created_at) ??
    readString(asset.created) ??
    new Date(0).toISOString()

  return {
    id,
    creatorId: readString(asset.creatorId) ?? readString(asset.creator_id) ?? readString(asset.userId) ?? readString(asset.user_id) ?? session.id,
    isSystem: asset.isSystem === true || asset.is_system === true,
    category,
    name,
    description: readString(asset.description) ?? '설명이 아직 없어요.',
    status,
    createdAt,
    widthCells: readNumber(asset.widthCells) ?? readNumber(asset.width_cells),
    heightCells: readNumber(asset.heightCells) ?? readNumber(asset.height_cells),
    sprites: normalizeSprites(asset.sprites, status, category),
  }
}

function normalizeSprites(
  value: unknown,
  fallbackStatus: WarehouseAssetRecord['status'],
  category: WarehouseAssetRecord['category'],
): WarehouseAssetSpriteRecord[] {
  if (!Array.isArray(value)) {
    return category === 'avatar'
      ? [
          { action: 'idle', status: fallbackStatus, lastRegenAt: null },
          { action: 'walk', status: fallbackStatus, lastRegenAt: null },
          { action: 'onair', status: fallbackStatus, lastRegenAt: null },
        ]
      : [{ action: 'static', status: fallbackStatus, lastRegenAt: null }]
  }

  return value.filter(isRecord).flatMap((sprite) => {
    const action = normalizeAction(readString(sprite.action))
    const status = normalizeStatus(readString(sprite.status)) ?? fallbackStatus

    return action
      ? [
          {
            action,
            status,
            lastRegenAt: readString(sprite.lastRegenAt) ?? readString(sprite.last_regen_at) ?? null,
          },
        ]
      : []
  })
}

function normalizeCategory(value: string | undefined): WarehouseAssetCategory | 'item' | null {
  if (
    value === 'avatar' ||
    value === 'platform' ||
    value === 'obstacle' ||
    value === 'monster' ||
    value === 'background' ||
    value === 'item'
  ) {
    return value
  }

  return null
}

function normalizeStatus(value: string | undefined): WarehouseAssetRecord['status'] | null {
  if (value === 'queued' || value === 'generating' || value === 'ready' || value === 'failed') {
    return value
  }

  return null
}

function normalizeAction(value: string | undefined): WarehouseReviewAction | null {
  if (value === 'idle' || value === 'walk' || value === 'onair' || value === 'static') {
    return value
  }

  return null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function createHeaders(session: LoginSession) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`,
  }
}

function mapHttpError(status: number, body: unknown): WarehouseResult<never> {
  const message = readBackendErrorMessage(body)

  if (status === 401 || status === 403) {
    return createFailure('authentication', message ?? '로그인이 필요해요.', true)
  }

  if (status === 404) {
    return createFailure('not_found', message ?? '에셋을 찾을 수 없어요.', true)
  }

  if (status === 409) {
    return createFailure('validation', message ?? '요청 가능한 상태가 아니에요.', false)
  }

  if (status === 429) {
    return createFailure('rate_limit', message ?? '잠시 후 다시 시도해주세요.', false)
  }

  if (status >= 500) {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', true)
  }

  return createFailure('validation', message ?? '요청 내용을 확인해주세요.', false)
}

function readBackendErrorMessage(body: unknown) {
  if (!isRecord(body) || !isRecord(body.error)) {
    return undefined
  }

  return readString(body.error.message)
}

function createFailure(
  kind: WarehouseControllerError['kind'],
  message: string,
  retryable: boolean,
): WarehouseResult<never> {
  return {
    ok: false,
    error: {
      kind,
      message,
      retryable,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
