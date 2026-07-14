import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  AvatarStudioAssetPort,
  AvatarStudioAssetRecord,
  AvatarStudioControllerError,
  AvatarStudioResult,
  AvatarStudioSubmitPayload,
} from '../../pages/avatar-studio/avatarStudioControllerCore'

interface AvatarStudioStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface MockAvatarStudioAssetPortOptions {
  storage?: AvatarStudioStorage
  nowMs?: () => number
}

const STORAGE_KEY = 'relay.mock.assets'

export function createMockAvatarStudioAssetPort({
  storage = getDefaultStorage(),
  nowMs = () => Date.now(),
}: MockAvatarStudioAssetPortOptions = {}): AvatarStudioAssetPort {
  return {
    async listAvatarAssets(session) {
      const avatars = ensureSeedAvatars(storage, session, nowMs())

      return {
        ok: true,
        value: avatars,
      }
    },
    async createAvatar(payload) {
      const name = payload.name.trim()

      if (name.length === 0 || name.length > 12) {
        return createFailure('validation', '아바타 이름은 1~12자로 입력해 주세요.', false)
      }

      ensureSeedAvatars(storage, createSessionFromPayload(payload), nowMs())
      const createdAt = new Date(nowMs()).toISOString()
      const avatar: AvatarStudioAssetRecord = {
        id: `mock-avatar-${nowMs()}`,
        creatorId: payload.userId,
        name,
        description: payload.description,
        status: 'generating',
        sourceImageUrl: payload.image,
        isMine: true,
      }

      saveAssets(storage, [
        {
          ...avatar,
          category: 'avatar',
          attrs: {},
          widthCells: null,
          heightCells: null,
          createdAt,
        },
        ...readRawAssets(storage),
      ])

      return {
        ok: true,
        value: avatar,
      }
    },
  }
}

function ensureSeedAvatars(
  storage: AvatarStudioStorage,
  session: LoginSession,
  nowMs: number,
) {
  const avatars = readAvatarAssets(storage, session.id)

  if (avatars.length > 0) {
    return avatars
  }

  const seedAssets = createSeedAssets(session, nowMs)

  saveAssets(storage, [...seedAssets, ...readRawAssets(storage)])
  return readAvatarAssets(storage, session.id)
}

function readAvatarAssets(storage: AvatarStudioStorage, userId: string): AvatarStudioAssetRecord[] {
  return readRawAssets(storage)
    .map((asset) => normalizeAvatar(asset, userId))
    .filter((asset): asset is AvatarStudioAssetRecord => asset !== null)
}

function readRawAssets(storage: AvatarStudioStorage): Array<Record<string, unknown>> {
  const rawValue = storage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue) as { assets?: unknown } | unknown[]
    const candidate = Array.isArray(parsed) ? parsed : parsed.assets

    return Array.isArray(candidate) ? candidate.filter(isRecord) : []
  } catch {
    return []
  }
}

function saveAssets(storage: AvatarStudioStorage, assets: Array<Record<string, unknown>>) {
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 'mock-avatar-studio-assets-v1',
      assets,
    }),
  )
}

function createSeedAssets(session: LoginSession, nowMs: number): Array<Record<string, unknown>> {
  return [
    {
      id: `${session.id}-avatar-ready`,
      creatorId: session.id,
      category: 'avatar',
      name: '달리기 아바타',
      description: '검증과 레이스에서 사용할 내 아바타입니다.',
      attrs: {},
      widthCells: null,
      heightCells: null,
      status: 'ready',
      sourceImageUrl: '',
      isPublic: false,
      createdAt: new Date(nowMs).toISOString(),
    },
    {
      id: 'other-avatar-ready',
      creatorId: 'other-user',
      category: 'avatar',
      name: '친구 아바타',
      description: '리믹스 참고용 아바타입니다.',
      attrs: {},
      widthCells: null,
      heightCells: null,
      status: 'ready',
      sourceImageUrl: '',
      isPublic: true,
      createdAt: new Date(nowMs).toISOString(),
    },
  ]
}

function normalizeAvatar(asset: Record<string, unknown>, userId: string): AvatarStudioAssetRecord | null {
  if (asset.category !== 'avatar') {
    return null
  }

  const id = readString(asset.id)
  const name = readString(asset.name)

  if (!id || !name) {
    return null
  }

  const creatorId = readString(asset.creatorId) ?? readString(asset.creator_id)

  return {
    id,
    creatorId: creatorId ?? null,
    name,
    description: readString(asset.description) ?? '',
    status: normalizeStatus(readString(asset.status)) ?? 'generating',
    sourceImageUrl: readString(asset.sourceImageUrl) ?? readString(asset.source_image_url) ?? '',
    isMine: (creatorId ?? userId) === userId,
  }
}

function createSessionFromPayload(payload: AvatarStudioSubmitPayload): LoginSession {
  return {
    id: payload.userId,
    nickname: 'mock',
    token: 'mock-token',
  }
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

function normalizeStatus(value: string | undefined): AvatarStudioAssetRecord['status'] | null {
  if (value === 'queued' || value === 'generating' || value === 'ready' || value === 'failed') {
    return value
  }

  return null
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getDefaultStorage(): AvatarStudioStorage {
  if (typeof window !== 'undefined') {
    return window.localStorage
  }

  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}
