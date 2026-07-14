import { createDeterministicMockSession } from '../session/mockSessionPort'
import type { DeviceLinkPort } from '../../pages/main/mainControllerCore'

const deterministicCode = 'TIGER-3392'
const expiredCode = 'EXPIRED-0000'

export function createMockDeviceLinkPort(): DeviceLinkPort {
  return {
    async issueDeviceCode() {
      return {
        ok: true,
        value: {
          code: deterministicCode,
          expiresAtMs: Date.now() + 5 * 60 * 1000,
        },
      }
    },
    async consumeDeviceCode(code) {
      if (code === deterministicCode) {
        return {
          ok: true,
          value: createDeterministicMockSession('릴레이러'),
        }
      }

      if (code === expiredCode) {
        return {
          ok: false,
          error: {
            kind: 'expired',
            message: '만료된 코드예요. 새 코드를 발급해주세요.',
            retryable: true,
          },
        }
      }

      return {
        ok: false,
        error: {
          kind: 'not_found',
          message: '사용할 수 없는 코드예요.',
          retryable: true,
        },
      }
    },
  }
}
