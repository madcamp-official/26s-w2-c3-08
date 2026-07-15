import type { LoginSession } from '../../pages/login/loginControllerCore'
import type {
  WarehouseAssetPort,
  WarehouseAssetRecord,
  WarehouseControllerError,
  WarehouseResult,
} from '../../pages/warehouse/warehouseControllerCore'

interface WarehouseAssetStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface MockWarehouseAssetPortOptions {
  storage?: WarehouseAssetStorage
  nowMs?: () => number
}

const storageKey = 'relay.mock.assets'

export function createMockWarehouseAssetPort({
  storage = getDefaultStorage(),
  nowMs = () => Date.now(),
}: MockWarehouseAssetPortOptions = {}): WarehouseAssetPort {
  return {
    async listAssets(session) {
      const assets = loadAssets(storage, session, nowMs)

      saveAssets(storage, assets)

      return {
        ok: true,
        value: assets,
      }
    },
    async equipAvatar(session, assetId) {
      const assets = loadAssets(storage, session, nowMs)
      const target = assets.find((asset) => asset.id === assetId)

      if (!target || target.category !== 'avatar' || target.status !== 'ready') {
        return createFailure('not_found', '사용할 수 있는 아바타를 찾을 수 없어요.', false)
      }

      return {
        ok: true,
        value: {
          ...session,
          avatarAssetId: assetId,
        },
      }
    },
    async retryAsset(session, assetId) {
      const assets = loadAssets(storage, session, nowMs)
      const target = assets.find((asset) => asset.id === assetId)

      if (!target || target.status !== 'failed') {
        return createFailure('not_found', '다시 시도할 실패 에셋을 찾을 수 없어요.', false)
      }

      const updatedAsset = {
        ...target,
        status: 'generating' as const,
        sprites: target.sprites.map((sprite) => ({ ...sprite, status: 'queued' as const })),
      }
      const nextAssets = replaceAsset(assets, updatedAsset)

      saveAssets(storage, nextAssets)

      return {
        ok: true,
        value: updatedAsset,
      }
    },
    async regenerateAction(session, assetId, action) {
      const assets = loadAssets(storage, session, nowMs)
      const target = assets.find((asset) => asset.id === assetId)

      if (!target || target.status !== 'ready') {
        return createFailure('not_found', '재생성할 수 있는 에셋을 찾을 수 없어요.', false)
      }

      const requestedAt = new Date(nowMs()).toISOString()
      const updatedAsset = {
        ...target,
        status: 'generating' as const,
        sprites: target.sprites.map((sprite) =>
          sprite.action === action
            ? { ...sprite, status: 'queued' as const, lastRegenAt: requestedAt }
            : sprite,
        ),
      }
      const nextAssets = replaceAsset(assets, updatedAsset)

      saveAssets(storage, nextAssets)

      return {
        ok: true,
        value: updatedAsset,
      }
    },
  }
}

function loadAssets(
  storage: WarehouseAssetStorage,
  session: LoginSession,
  nowMs: () => number,
): WarehouseAssetRecord[] {
  const storedAssets = readStoredAssets(storage)

  if (storedAssets.length > 0) {
    return storedAssets
  }

  return createSeedAssets(session, nowMs())
}

function readStoredAssets(storage: WarehouseAssetStorage): WarehouseAssetRecord[] {
  const rawValue = storage.getItem(storageKey)

  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue) as { assets?: unknown } | unknown[]
    const candidate = Array.isArray(parsed) ? parsed : parsed.assets

    return Array.isArray(candidate) ? candidate.filter(isWarehouseAssetRecord) : []
  } catch {
    return []
  }
}

function saveAssets(storage: WarehouseAssetStorage, assets: WarehouseAssetRecord[]) {
  storage.setItem(
    storageKey,
    JSON.stringify({
      schemaVersion: 'mock-warehouse-assets-v1',
      assets,
    }),
  )
}

function createSeedAssets(session: LoginSession, nowMs: number): WarehouseAssetRecord[] {
  const createdAt = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()

  return [
    {
      id: `${session.id}-avatar-ready`,
      creatorId: session.id,
      isSystem: false,
      category: 'avatar',
      name: `${session.nickname} 아바타`,
      description: '게임에서 바로 장착할 수 있는 내 아바타입니다.',
      sourceImageUrl: '',
      status: 'ready',
      createdAt,
      widthCells: null,
      heightCells: null,
      sprites: [
        { action: 'idle', status: 'ready', lastRegenAt: null },
        { action: 'walk', status: 'ready', lastRegenAt: null },
        { action: 'onair', status: 'ready', lastRegenAt: null },
      ],
    },
    {
      id: `${session.id}-platform-generating`,
      creatorId: session.id,
      isSystem: false,
      category: 'platform',
      name: '구름 발판',
      description: '생성 중인 플랫폼 컴포넌트입니다.',
      sourceImageUrl: '',
      status: 'generating',
      createdAt,
      widthCells: 4,
      heightCells: 1,
      sprites: [{ action: 'static', status: 'generating', lastRegenAt: null }],
    },
    {
      id: `${session.id}-obstacle-failed`,
      creatorId: session.id,
      isSystem: false,
      category: 'obstacle',
      name: '반짝 가시',
      description: '다시 시도할 수 있는 실패 에셋입니다.',
      sourceImageUrl: '',
      status: 'failed',
      createdAt,
      widthCells: 1,
      heightCells: 1,
      sprites: [{ action: 'static', status: 'failed', lastRegenAt: null }],
    },
    {
      id: `${session.id}-monster-ready`,
      creatorId: session.id,
      isSystem: false,
      category: 'monster',
      name: '순찰 로봇',
      description: '스테이지에 배치할 수 있는 몬스터입니다.',
      sourceImageUrl: '',
      status: 'ready',
      createdAt,
      widthCells: 1,
      heightCells: 2,
      sprites: [{ action: 'static', status: 'ready', lastRegenAt: null }],
    },
    {
      id: `${session.id}-background-ready`,
      creatorId: session.id,
      isSystem: false,
      category: 'background',
      name: '노을 배경',
      description: '맵 분위기를 바꿔주는 배경 에셋입니다.',
      sourceImageUrl: '',
      status: 'ready',
      createdAt,
      widthCells: 16,
      heightCells: 9,
      sprites: [{ action: 'static', status: 'ready', lastRegenAt: null }],
    },
  ]
}

function replaceAsset(assets: WarehouseAssetRecord[], updatedAsset: WarehouseAssetRecord) {
  return assets.map((asset) => (asset.id === updatedAsset.id ? updatedAsset : asset))
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

function isWarehouseAssetRecord(value: unknown): value is WarehouseAssetRecord {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.id === 'string' && typeof value.name === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getDefaultStorage(): WarehouseAssetStorage {
  if (typeof window !== 'undefined') {
    return window.localStorage
  }

  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}
