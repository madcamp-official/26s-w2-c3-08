import {
  createDefaultAvatarStudioLayout,
  type AvatarStudioLayoutStorage,
} from '../../pages/avatar-studio/avatarStudioControllerCore'
import type { AvatarStudioLayoutValue } from '../../pages/avatar-studio/AvatarStudioScreen'

const STORAGE_KEY = 'relay.avatarStudioLayout'

export function createBrowserAvatarStudioLayoutStorage(
  storage: Storage | null = getStorage(),
): AvatarStudioLayoutStorage {
  return {
    loadLayout() {
      if (!storage) {
        return createDefaultAvatarStudioLayout()
      }

      const rawValue = storage.getItem(STORAGE_KEY)

      if (!rawValue) {
        return createDefaultAvatarStudioLayout()
      }

      try {
        return normalizeLayout(JSON.parse(rawValue))
      } catch {
        return createDefaultAvatarStudioLayout()
      }
    },
    saveLayout(layout) {
      storage?.setItem(STORAGE_KEY, JSON.stringify(layout))
    },
  }
}

function normalizeLayout(value: unknown): AvatarStudioLayoutValue {
  if (!isRecord(value)) {
    return createDefaultAvatarStudioLayout()
  }

  return {
    leftCollapsed: value.leftCollapsed === true,
    rightCollapsed: value.rightCollapsed === true,
    leftPanelWidth: clampPanelWidth(readNumber(value.leftPanelWidth) ?? 292),
    rightPanelWidth: clampPanelWidth(readNumber(value.rightPanelWidth) ?? 320),
    resizing:
      value.resizing === 'left' ||
      value.resizing === 'right'
        ? value.resizing
        : null,
  }
}

function clampPanelWidth(value: number) {
  return Math.min(420, Math.max(220, Math.round(value)))
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}
