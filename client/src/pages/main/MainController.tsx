import { useMemo } from 'react'

import { getPrototypeHref, setPrototypeRoute } from '../../app/navigation/prototypeRouter'
import { resolveV2ModeConfig, type V2ModeConfig } from '../../infrastructure/config/modeConfig'
import { createMockAssetPort } from '../../infrastructure/main/mockAssetPort'
import { createRemoteAssetPort } from '../../infrastructure/main/remoteAssetPort'
import { createBrowserSettingsStoragePort } from '../../infrastructure/settings/browserSettingsStoragePort'
import { createMockDeviceLinkPort } from '../../infrastructure/settings/mockDeviceLinkPort'
import { createMockMainSessionPort } from '../../infrastructure/settings/mockMainSessionPort'
import { createRemoteDeviceLinkPort } from '../../infrastructure/settings/remoteDeviceLinkPort'
import { createRemoteMainSessionPort } from '../../infrastructure/settings/remoteMainSessionPort'
import { createBrowserSessionStoragePort } from '../../infrastructure/session/browserSessionStoragePort'
import { MainScreen } from './MainScreen'
import { useMainController, type MainControllerDependencies } from './useMainController'

export interface MainControllerProps {
  dependencies?: Partial<MainControllerDependencies>
}

export function MainController({ dependencies }: MainControllerProps) {
  const defaultDependencies = useMemo(() => createMainControllerDependencies(), [])
  const resolvedDependencies = useMemo<MainControllerDependencies>(
    () => ({
      ...defaultDependencies,
      ...dependencies,
    }),
    [defaultDependencies, dependencies],
  )
  const screenProps = useMainController(resolvedDependencies)

  return (
    <div
      data-v2-component="main-controller"
      data-v2-data-mode={resolvedDependencies.dataMode}
    >
      <MainScreen {...screenProps} />
    </div>
  )
}

export function createMainControllerDependencies(
  modeConfig: Pick<V2ModeConfig, 'dataMode'> = resolveV2ModeConfig(),
): MainControllerDependencies {
  const { dataMode } = modeConfig

  return {
    dataMode,
    sessionStoragePort: createBrowserSessionStoragePort(),
    settingsStoragePort: createBrowserSettingsStoragePort(),
    sessionPort: dataMode === 'mock' ? createMockMainSessionPort() : createRemoteMainSessionPort(),
    assetPort: dataMode === 'mock' ? createMockAssetPort() : createRemoteAssetPort(),
    deviceLinkPort: dataMode === 'mock' ? createMockDeviceLinkPort() : createRemoteDeviceLinkPort(),
    routePort: {
      navigateLogin: () => setPrototypeRoute('login'),
      navigateLobby: () => setPrototypeRoute('lobby'),
      navigateAssetStudio: () => setPrototypeRoute('asset-studio'),
      navigateWarehouse: (tab) => {
        if (tab === 'component') {
          setPrototypeRoute('warehouse', { tab: 'component', filter: 'all' })
          return
        }

        setPrototypeRoute('warehouse', { tab: 'avatar' })
      },
    },
  }
}

export function getWarehouseHref(tab: 'avatar' | 'component') {
  if (tab === 'component') {
    return getPrototypeHref('warehouse', { tab: 'component', filter: 'all' })
  }

  return getPrototypeHref('warehouse', { tab: 'avatar' })
}
