import type { LoginSession } from '../../pages/login/loginControllerCore'
import type { MainSessionPort } from '../../pages/main/mainControllerCore'

export function createMockMainSessionPort(): MainSessionPort {
  return {
    async updateNickname(session, nickname) {
      const updatedSession: LoginSession = {
        ...session,
        nickname,
      }

      return {
        ok: true,
        value: updatedSession,
      }
    },
  }
}
