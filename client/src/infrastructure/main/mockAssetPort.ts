import type { AssetPort, MainSnapshot } from '../../pages/main/mainControllerCore'

const mockSnapshot: MainSnapshot = {
  mainState: 'systemAvatar',
  avatar: {
    state: 'system',
    title: '기본 아바타 · 졸라맨',
    description: '아바타가 없어도 바로 게임을 시작할 수 있어요.',
    statusText: '사용 가능',
  },
  assetSummary: {
    total: 6,
    ready: 4,
    working: 1,
    failed: 1,
  },
}

export function createMockAssetPort(): AssetPort {
  return {
    async loadMainSnapshot() {
      return {
        ok: true,
        value: mockSnapshot,
      }
    },
  }
}
