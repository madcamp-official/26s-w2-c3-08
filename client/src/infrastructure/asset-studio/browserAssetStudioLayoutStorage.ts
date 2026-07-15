import {
  createDefaultAssetStudioLayout,
  type AssetStudioLayoutStorage,
} from '../../pages/asset-studio/assetStudioControllerCore'
import type { AssetStudioLayoutValue } from '../../pages/asset-studio/AssetStudioScreen'

const STORAGE_KEY = 'relay.studioLayout'

export function createBrowserAssetStudioLayoutStorage(
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
): AssetStudioLayoutStorage {
  return {
    loadLayout() {
      const rawValue = storage.getItem(STORAGE_KEY)

      if (!rawValue) {
        return createDefaultAssetStudioLayout()
      }

      try {
        return normalizeLayout(JSON.parse(rawValue))
      } catch {
        return createDefaultAssetStudioLayout()
      }
    },
    saveLayout(layout) {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizeLayout(layout)))
    },
  }
}

function normalizeLayout(value: unknown): AssetStudioLayoutValue {
  const defaults = createDefaultAssetStudioLayout()

  if (!isRecord(value)) {
    return defaults
  }

  return {
    leftCollapsed: value.leftCollapsed === true,
    rightCollapsed: value.rightCollapsed === true,
    leftPanelWidth: clampPanelWidth(readNumber(value.leftPanelWidth) ?? defaults.leftPanelWidth),
    rightPanelWidth: clampPanelWidth(readNumber(value.rightPanelWidth) ?? defaults.rightPanelWidth),
    resizing: null,
  }
}

function clampPanelWidth(value: number) {
  return Math.min(420, Math.max(220, Math.trunc(value)))
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
