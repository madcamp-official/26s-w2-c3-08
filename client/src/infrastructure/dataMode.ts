import type { LoginDataMode } from '../pages/login/loginControllerCore'
import {
  ConfigurationError,
  parseDataMode,
  type ModeEnv,
} from './config/modeConfig'

export { ConfigurationError }

export interface V2Environment extends ModeEnv {
  MODE?: string
  PROD?: boolean
}

export function resolveV2DataMode(env: V2Environment = import.meta.env): LoginDataMode {
  return parseDataMode(env.VITE_DATA_MODE, {
    isProduction: env.PROD === true || env.MODE === 'production',
  })
}
