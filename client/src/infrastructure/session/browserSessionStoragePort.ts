import type { LoginSession, StoragePort } from '../../pages/login/loginControllerCore'

const SESSION_STORAGE_KEY = 'relay.session'

export function createBrowserSessionStoragePort(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage,
): StoragePort {
  return {
    loadSession() {
      const rawSession = storage.getItem(SESSION_STORAGE_KEY)

      if (!rawSession) {
        return null
      }

      try {
        const parsedSession = JSON.parse(rawSession) as Partial<LoginSession>

        if (
          typeof parsedSession.id === 'string' &&
          typeof parsedSession.nickname === 'string' &&
          typeof parsedSession.token === 'string'
        ) {
          return {
            id: parsedSession.id,
            nickname: parsedSession.nickname,
            token: parsedSession.token,
            avatarAssetId:
              typeof parsedSession.avatarAssetId === 'string'
                ? parsedSession.avatarAssetId
                : undefined,
          }
        }
      } catch {
        storage.removeItem(SESSION_STORAGE_KEY)
      }

      storage.removeItem(SESSION_STORAGE_KEY)
      return null
    },
    saveSession(session) {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    },
    clearSession() {
      storage.removeItem(SESSION_STORAGE_KEY)
    },
  }
}
