import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  AssetStudioAssetPort,
  AssetStudioAssetRecord,
  AssetStudioControllerError,
  AssetStudioResult,
  AssetStudioSubmitPayload,
} from '../../pages/asset-studio/assetStudioControllerCore'
import {
  logMalformedResponse,
  type MalformedResponseReason,
} from '../diagnostics/malformedResponseLogger'

interface RemoteAssetStudioAssetPortOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

export function createRemoteAssetStudioAssetPort({
  baseUrl = '',
  fetcher = fetch,
}: RemoteAssetStudioAssetPortOptions = {}): AssetStudioAssetPort {
  return {
    async listLoadableAssets(session) {
      return requestAssets(fetcher, `${baseUrl}/api/assets?user_id=${encodeURIComponent(session.id)}`, session)
    },
    async createComponentAsset(payload) {
      return requestCreateAsset(fetcher, `${baseUrl}/api/assets/generate`, payload)
    },
  }
}

async function requestAssets(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
): Promise<AssetStudioResult<AssetStudioAssetRecord[]>> {
  let response: Response

  try {
    response = await fetcher(input, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    })
  } catch {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', true)
  }

  if (!response.ok) {
    return mapHttpError(response.status, await readJsonSafely(response))
  }

  return normalizeAssetsResponse(response, input, session)
}

async function requestCreateAsset(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  payload: AssetStudioSubmitPayload,
): Promise<AssetStudioResult<AssetStudioAssetRecord>> {
  let response: Response

  try {
    response = await fetcher(input, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.sessionToken}`,
      },
      body: JSON.stringify(createAssetBody(payload)),
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
    return createMalformedFailure('assetStudio.createAsset', input, 'invalid_json', undefined, response.status)
  }

  const record = unwrapAsset(body)
  const normalizedAsset = record ? normalizeAsset(record, payload.userId) : null

  if (!normalizedAsset) {
    return createMalformedFailure('assetStudio.createAsset', input, 'unexpected_shape', body, response.status)
  }

  return {
    ok: true,
    value: normalizedAsset,
  }
}

async function normalizeAssetsResponse(
  response: Response,
  input: RequestInfo | URL,
  session: LoginSession,
): Promise<AssetStudioResult<AssetStudioAssetRecord[]>> {
  let body: unknown

  try {
    body = await response.json()
  } catch {
    return createMalformedFailure('assetStudio.listAssets', input, 'invalid_json', undefined, response.status)
  }

  const records = unwrapAssets(body)

  if (!records) {
    return createMalformedFailure('assetStudio.listAssets', input, 'unexpected_shape', body, response.status)
  }

  const assets = records
    .map((record) => normalizeAsset(record, session.id))
    .filter((asset): asset is AssetStudioAssetRecord => asset !== null)

  return {
    ok: true,
    value: assets,
  }
}

function createMalformedFailure<T>(
  operation: string,
  input: RequestInfo | URL,
  reason: MalformedResponseReason,
  body?: unknown,
  status?: number,
): AssetStudioResult<T> {
  logMalformedResponse({
    source: 'api',
    adapter: 'remoteAssetStudioAssetPort',
    operation,
    reason,
    endpoint: input,
    status,
    body,
  })

  return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
}

function createAssetBody(payload: AssetStudioSubmitPayload) {
  return {
    user_id: payload.userId,
    category: payload.category,
    name: payload.name,
    user_prompt: payload.description || payload.name,
    description: payload.description,
    image: payload.image,
    attrs: payload.attrs,
    width_cells: payload.widthCells,
    height_cells: payload.heightCells,
    remix_of_id: payload.remixOfId,
  }
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function mapHttpError(status: number, body: unknown): AssetStudioResult<never> {
  const message = readBackendErrorMessage(body)

  if (status === 401 || status === 403) {
    return createFailure('authentication', message ?? '로그인이 필요해요. 다시 로그인해주세요.', true)
  }

  if (status === 404) {
    return createFailure('not_found', message ?? '에셋을 찾을 수 없어요.', true)
  }

  if (status >= 500) {
    return createFailure('server_unavailable', message ?? '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', true)
  }

  return createFailure('validation', message ?? '에셋 생성 요청을 확인해주세요.', false)
}

function readBackendErrorMessage(body: unknown) {
  if (!isRecord(body) || !isRecord(body.error)) {
    return undefined
  }

  return readString(body.error.message)
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

  if (isRecord(body.asset)) {
    return body.asset
  }

  if (isRecord(body.data)) {
    return body.data
  }

  return body
}

function normalizeAsset(
  asset: Record<string, unknown>,
  userId: string,
): AssetStudioAssetRecord | null {
  const id = readString(asset.id)
  const name = readString(asset.name) ?? readString(asset.title)
  const category = normalizeCategory(readString(asset.category))
  const status = normalizeStatus(readString(asset.status)) ?? 'generating'

  if (!id || !name || !category) {
    return null
  }

  const creatorId =
    readString(asset.creatorId) ??
    readString(asset.creator_id) ??
    readString(asset.userId) ??
    readString(asset.user_id)

  return {
    id,
    creatorId: creatorId ?? null,
    category,
    name,
    description: readString(asset.description) ?? '',
    attrs: normalizeAttrs(asset.attrs),
    widthCells: readNumber(asset.widthCells) ?? readNumber(asset.width_cells) ?? 1,
    heightCells: readNumber(asset.heightCells) ?? readNumber(asset.height_cells) ?? 1,
    status,
    sourceImageUrl:
      readString(asset.sourceImageUrl) ??
      readString(asset.source_image_url) ??
      readString(asset.image) ??
      '',
    isMine: (creatorId ?? userId) === userId,
  }
}

function normalizeCategory(value: string | undefined): AssetStudioAssetRecord['category'] | null {
  if (value === 'platform' || value === 'obstacle' || value === 'monster' || value === 'background') {
    return value
  }

  return null
}

function normalizeStatus(value: string | undefined): AssetStudioAssetRecord['status'] | null {
  if (value === 'queued' || value === 'generating' || value === 'ready' || value === 'failed') {
    return value
  }

  return null
}

function normalizeAttrs(value: unknown): AssetStudioAssetRecord['attrs'] {
  if (!isRecord(value)) {
    return {}
  }

  const attrs: AssetStudioAssetRecord['attrs'] = {}

  for (const [key, attrValue] of Object.entries(value)) {
    if (
      typeof attrValue === 'string' ||
      typeof attrValue === 'number' ||
      typeof attrValue === 'boolean' ||
      attrValue === null
    ) {
      attrs[key] = attrValue
    }
  }

  return attrs
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined
}

function createFailure(
  kind: AssetStudioControllerError['kind'],
  message: string,
  retryable: boolean,
): AssetStudioResult<never> {
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
