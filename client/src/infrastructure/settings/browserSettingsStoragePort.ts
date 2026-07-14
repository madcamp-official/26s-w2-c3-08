import type { SettingsValues } from '../../pages/main/MainScreen'
import {
  defaultSettingsValues,
  type SettingsStoragePort,
} from '../../pages/main/mainControllerCore'

const SETTINGS_STORAGE_KEY = 'relay.settings'

export function createBrowserSettingsStoragePort(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage,
): SettingsStoragePort {
  return {
    loadSettings() {
      const rawSettings = storage.getItem(SETTINGS_STORAGE_KEY)

      if (!rawSettings) {
        return defaultSettingsValues
      }

      try {
        return normalizeSettings(JSON.parse(rawSettings))
      } catch {
        storage.removeItem(SETTINGS_STORAGE_KEY)
        return defaultSettingsValues
      }
    },
    saveSettings(values) {
      storage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 'settings-v1',
          bgmVolume: clampVolume(values.bgmVolume),
          sfxVolume: clampVolume(values.sfxVolume),
          bgmMuted: values.muted,
          sfxMuted: values.muted,
          muted: values.muted,
          nickname: values.nickname,
        }),
      )
    },
  }
}

function normalizeSettings(value: unknown): SettingsValues {
  if (!isRecord(value)) {
    return defaultSettingsValues
  }

  const muted = Boolean(value.muted ?? value.bgmMuted ?? value.sfxMuted)

  return {
    bgmVolume: clampVolume(Number(value.bgmVolume ?? defaultSettingsValues.bgmVolume)),
    sfxVolume: clampVolume(Number(value.sfxVolume ?? defaultSettingsValues.sfxVolume)),
    muted,
    nickname: typeof value.nickname === 'string' ? value.nickname : defaultSettingsValues.nickname,
    issuedCode: undefined,
    deviceCodeInput: '',
  }
}

function clampVolume(value: number) {
  if (Number.isNaN(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round(value)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
