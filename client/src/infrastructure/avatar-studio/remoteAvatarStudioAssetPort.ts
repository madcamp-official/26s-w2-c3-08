import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  AvatarStudioAssetPort,
  AvatarStudioAssetRecord,
  AvatarStudioControllerError,
  AvatarStudioResult,
  AvatarStudioSubmitPayload,
} from '../../pages/avatar-studio/avatarStudioControllerCore'

interface RemoteAvatarStudioAssetPortOptions {
  baseUrl?: string
  fetcher?: typeof fetch
}

export function createRemoteAvatarStudioAssetPort({
  baseUrl = '',
  fetcher = fetch,
}: RemoteAvatarStudioAssetPortOptions = {}): AvatarStudioAssetPort {
  return {
    async listAvatarAssets(session) {
      return requestAvatars(fetcher, `${baseUrl}/api/assets?user_id=${encodeURIComponent(session.id)}`, session)
    },
    async createAvatar(payload) {
      return requestCreateAvatar(fetcher, `${baseUrl}/api/assets/generate`, payload)
    },
  }
}

async function requestAvatars(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  session: LoginSession,
): Promise<AvatarStudioResult<AvatarStudioAssetRecord[]>> {
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
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', true)
  }

  let body: unknown

  try {
    body = await response.json()
  } catch {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
  }

  const records = unwrapAssets(body)

  if (!records) {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
  }

  return {
    ok: true,
    value: records
      .map((record) => normalizeAvatar(record, session.id))
      .filter((asset): asset is AvatarStudioAssetRecord => asset !== null),
  }
}

async function requestCreateAvatar(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  payload: AvatarStudioSubmitPayload,
): Promise<AvatarStudioResult<AvatarStudioAssetRecord>> {
  let response: Response

  try {
    response = await fetcher(input, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.sessionToken}`,
      },
      body: JSON.stringify(createAvatarBody(payload)),
    })
  } catch {
    return createFailure('server_unavailable', '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', true)
  }

  if (!response.ok) {
    return createFailure('server_unavailable', '아바타 저장 요청을 완료하지 못했어요.', true)
  }

  let body: unknown

  try {
    body = await response.json()
  } catch {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
  }

  const record = unwrapAsset(body)
  const normalizedAvatar = record ? normalizeAvatar(record, payload.userId) : null

  if (!normalizedAvatar) {
    return createFailure('malformed_response', '서버 응답 형식이 올바르지 않아요.', false)
  }

  return {
    ok: true,
    value: normalizedAvatar,
  }
}

function createAvatarBody(payload: AvatarStudioSubmitPayload) {
  return {
    user_id: payload.userId,
    category: 'avatar',
    name: payload.name,
    user_prompt: payload.description || payload.name,
    description: payload.description,
    image: payload.image,
    attrs: { kind: 'avatar' },
    remix_of_id: payload.remixOfId,
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

  if (isRecord(body.asset)) {
    return body.asset
  }

  if (isRecord(body.data)) {
    return body.data
  }

  return body
}

function normalizeAvatar(
  asset: Record<string, unknown>,
  userId: string,
): AvatarStudioAssetRecord | null {
  const category = readString(asset.category)

  if (category !== 'avatar') {
    return null
  }

  const id = readString(asset.id)
  const name = readString(asset.name) ?? readString(asset.title)

  if (!id || !name) {
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
    name,
    description: readString(asset.description) ?? '',
    status: normalizeStatus(readString(asset.status)) ?? 'generating',
    sourceImageUrl:
      readString(asset.sourceImageUrl) ??
      readString(asset.source_image_url) ??
      readString(asset.image) ??
      '',
    isMine: (creatorId ?? userId) === userId,
  }
}

function normalizeStatus(value: string | undefined): AvatarStudioAssetRecord['status'] | null {
  if (value === 'queued' || value === 'generating' || value === 'ready' || value === 'failed') {
    return value
  }

  return null
}

function createFailure(
  kind: AvatarStudioControllerError['kind'],
  message: string,
  retryable: boolean,
): AvatarStudioResult<never> {
  return {
    ok: false,
    error: {
      kind,
      message,
      retryable,
    },
  }
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
