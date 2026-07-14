import { useMemo } from 'react'

import { setPrototypeRoute } from '../../app/navigation/prototypeRouter'
import { resolveV2ModeConfig, type V2ModeConfig } from '../../infrastructure/config/modeConfig'
import { createAssetStudioDrawingPort } from '../../infrastructure/asset-studio/assetStudioDrawingPort'
import { createBrowserAssetStudioLayoutStorage } from '../../infrastructure/asset-studio/browserAssetStudioLayoutStorage'
import { createMockAssetStudioAssetPort } from '../../infrastructure/asset-studio/mockAssetStudioAssetPort'
import { createRemoteAssetStudioAssetPort } from '../../infrastructure/asset-studio/remoteAssetStudioAssetPort'
import { createBrowserSessionStoragePort } from '../../infrastructure/session/browserSessionStoragePort'
import { AssetStudioScreen } from './AssetStudioScreen'
import {
  useAssetStudioController,
  type AssetStudioControllerDependencies,
  type AssetStudioRouteState,
} from './useAssetStudioController'

export interface AssetStudioControllerProps {
  routeState: AssetStudioRouteState
  dependencies?: Partial<AssetStudioControllerDependencies>
}

export function AssetStudioController({
  routeState,
  dependencies,
}: AssetStudioControllerProps) {
  const modeConfig = useMemo(() => resolveV2ModeConfig(), [])
  const defaultDependencies = useMemo(
    () => createAssetStudioControllerDependencies(modeConfig),
    [modeConfig],
  )
  const resolvedDependencies = useMemo<AssetStudioControllerDependencies>(
    () => ({
      ...defaultDependencies,
      ...dependencies,
    }),
    [defaultDependencies, dependencies],
  )
  const screenProps = useAssetStudioController(resolvedDependencies, routeState)

  return (
    <div
      data-v2-component="asset-studio-controller"
      data-v2-data-mode={resolvedDependencies.dataMode}
    >
      <AssetStudioScreen {...screenProps} />
    </div>
  )
}

export function createAssetStudioControllerDependencies(
  modeConfig: V2ModeConfig = resolveV2ModeConfig(),
): AssetStudioControllerDependencies {
  return {
    dataMode: modeConfig.dataMode,
    sessionStoragePort: createBrowserSessionStoragePort(),
    layoutStorage: createBrowserAssetStudioLayoutStorage(),
    assetPort:
      modeConfig.dataMode === 'mock'
        ? createMockAssetStudioAssetPort()
        : createRemoteAssetStudioAssetPort(),
    drawingPort: createAssetStudioDrawingPort(),
    routePort: {
      navigateLogin: () => setPrototypeRoute('login'),
      navigateMain: () => setPrototypeRoute('main'),
      navigateWarehouseComponent: () =>
        setPrototypeRoute('warehouse', { tab: 'component', filter: 'all' }),
    },
  }
}
