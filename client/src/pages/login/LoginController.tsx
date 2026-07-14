import { useMemo } from 'react'

import { resolveV2ModeConfig, type V2ModeConfig } from '../../infrastructure/config/modeConfig'
import { createBrowserSessionStoragePort } from '../../infrastructure/session/browserSessionStoragePort'
import { createMockSessionPort } from '../../infrastructure/session/mockSessionPort'
import { createRemoteSessionPort } from '../../infrastructure/session/remoteSessionPort'
import { setPrototypeRoute } from '../../app/navigation/prototypeRouter'
import { LoginScreen } from './LoginScreen'
import type {
  LoginDataMode,
  LoginRoutePort,
  SessionPort,
  StoragePort,
} from './loginControllerCore'
import { useLoginController } from './useLoginController'

export interface LoginControllerDependencies {
  dataMode: LoginDataMode
  sessionPort: SessionPort
  storagePort: StoragePort
  routePort: LoginRoutePort
}

export interface LoginControllerProps {
  dependencies?: Partial<LoginControllerDependencies>
}

export function LoginController({ dependencies }: LoginControllerProps) {
  const defaultDependencies = useMemo(() => createLoginControllerDependencies(), [])
  const resolvedDependencies = {
    ...defaultDependencies,
    ...dependencies,
  }
  const screenProps = useLoginController(resolvedDependencies)

  return (
    <div
      data-v2-component="login-controller"
      data-v2-data-mode={resolvedDependencies.dataMode}
    >
      <LoginScreen {...screenProps} />
    </div>
  )
}

export function createLoginControllerDependencies(
  modeConfig: Pick<V2ModeConfig, 'dataMode'> = resolveV2ModeConfig(),
): LoginControllerDependencies {
  const { dataMode } = modeConfig

  return {
    dataMode,
    sessionPort: dataMode === 'mock' ? createMockSessionPort() : createRemoteSessionPort(),
    storagePort: createBrowserSessionStoragePort(),
    routePort: {
      navigateMain: () => setPrototypeRoute('main'),
    },
  }
}
