import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  AssetStudioAssetPort,
  AssetStudioAssetRecord,
  AssetStudioControllerError,
  AssetStudioResult,
  AssetStudioSubmitPayload,
} from '../../pages/asset-studio/assetStudioControllerCore'

interface AssetStudioStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface MockAssetStudioAssetPortOptions {
  storage?: AssetStudioStorage
  nowMs?: () => number
}

const STORAGE_KEY = 'relay.mock.assets'

export function createMockAssetStudioAssetPort({
  storage = getDefaultStorage(),
  nowMs = () => Date.now(),
}: MockAssetStudioAssetPortOptions = {}): AssetStudioAssetPort {
  return {
    async listLoadableAssets(session) {
      const assets = ensureSeedAssets(storage, session, nowMs())

      return {
        ok: true,
        value: assets,
      }
    },
    async createComponentAsset(payload) {
      if (!isUserCreatableCategory(payload.category)) {
        return createFailure('validation', '선택할 수 없는 카테고리입니다.', false)
      }

      const assets = ensureSeedAssets(storage, createSessionFromPayload(payload), nowMs())
      const createdAt = new Date(nowMs()).toISOString()
      const asset: AssetStudioAssetRecord = {
        id: `mock-asset-${nowMs()}`,
        creatorId: payload.userId,
        category: payload.category,
        name: payload.name,
        description: payload.description,
        attrs: payload.attrs,
        widthCells: payload.widthCells,
        heightCells: payload.heightCells,
        status: 'generating',
        sourceImageUrl: payload.image,
        isMine: true,
      }

      saveAssets(storage, [
        {
          ...asset,
          createdAt,
        },
        ...assets,
      ])

      return {
        ok: true,
        value: asset,
      }
    },
  }
}

function ensureSeedAssets(
  storage: AssetStudioStorage,
  session: LoginSession,
  nowMs: number,
) {
  const storedAssets = readAssets(storage)

  if (storedAssets.length > 0) {
    return storedAssets
  }

  const seedAssets = createSeedAssets(session, nowMs)

  saveAssets(storage, seedAssets)
  return seedAssets
}

function readAssets(storage: AssetStudioStorage): AssetStudioAssetRecord[] {
  const rawValue = storage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue) as { assets?: unknown } | unknown[]
    const candidate = Array.isArray(parsed) ? parsed : parsed.assets

    return Array.isArray(candidate)
      ? candidate.filter(isAssetStudioAssetRecord).filter((asset) => isUserCreatableCategory(asset.category))
      : []
  } catch {
    return []
  }
}

function saveAssets(storage: AssetStudioStorage, assets: Array<AssetStudioAssetRecord & { createdAt?: string }>) {
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 'mock-asset-studio-assets-v1',
      assets,
    }),
  )
}

function createSeedAssets(session: LoginSession, _nowMs: number): AssetStudioAssetRecord[] {
  return [
    {
      id: `${session.id}-studio-platform-ready`,
      creatorId: session.id,
      category: 'platform',
      name: '튼튼한 발판 원본',
      description: '불러와서 수정할 수 있는 내 플랫폼입니다.',
      attrs: { behaviors: 'solid', collider: 'solid', motion: 'static' },
      widthCells: 2,
      heightCells: 1,
      status: 'ready',
      sourceImageUrl: '',
      isMine: true,
    },
    {
      id: `${session.id}-studio-monster-ready`,
      creatorId: session.id,
      category: 'monster',
      name: '순찰 로봇',
      description: '몬스터 액션 세트를 만들 수 있는 원본입니다.',
      attrs: { behaviors: 'moving,dangerous', collider: 'hazard', motion: 'patrol' },
      widthCells: 1,
      heightCells: 2,
      status: 'ready',
      sourceImageUrl: '',
      isMine: true,
    },
    {
      id: 'other-studio-background-ready',
      creatorId: 'other-user',
      category: 'background',
      name: '남이 만든 노을 배경',
      description: '리믹스 참고용 배경입니다.',
      attrs: { behaviors: '', collider: 'none', motion: 'static' },
      widthCells: 6,
      heightCells: 3,
      status: 'ready',
      sourceImageUrl: '',
      isMine: false,
    },
  ]
}

function createSessionFromPayload(payload: AssetStudioSubmitPayload): LoginSession {
  return {
    id: payload.userId,
    nickname: 'mock',
    token: 'mock-token',
  }
}

function isAssetStudioAssetRecord(value: unknown): value is AssetStudioAssetRecord {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isUserCreatableCategory(value.category) &&
    typeof value.widthCells === 'number' &&
    typeof value.heightCells === 'number'
  )
}

function isUserCreatableCategory(value: unknown): value is AssetStudioAssetRecord['category'] {
  return value === 'platform' || value === 'obstacle' || value === 'monster' || value === 'background'
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

function getDefaultStorage(): AssetStudioStorage {
  if (typeof window !== 'undefined') {
    return window.localStorage
  }

  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}
