import { useMemo } from 'react'

import { setPrototypeRoute } from '../../app/navigation/prototypeRouter'
import { resolveV2ModeConfig, type V2ModeConfig } from '../../infrastructure/config/modeConfig'
import { createBrowserSessionStoragePort } from '../../infrastructure/session/browserSessionStoragePort'
import { createLocalAssetJobUpdates } from '../../infrastructure/warehouse/localAssetJobUpdates'
import { createMockWarehouseAssetPort } from '../../infrastructure/warehouse/mockWarehouseAssetPort'
import { createRemoteAssetJobUpdates } from '../../infrastructure/warehouse/remoteAssetJobUpdates'
import { createRemoteWarehouseAssetPort } from '../../infrastructure/warehouse/remoteWarehouseAssetPort'
import { WarehouseScreen, type WarehouseFilter, type WarehouseTab } from './WarehouseScreen'
import { useWarehouseController, type WarehouseControllerDependencies } from './useWarehouseController'

export interface WarehouseControllerProps {
  initialTab?: WarehouseTab
  initialFilter?: WarehouseFilter
  dependencies?: Partial<WarehouseControllerDependencies>
}

export function WarehouseController({
  initialTab = 'component',
  initialFilter = 'all',
  dependencies,
}: WarehouseControllerProps) {
  const modeConfig = useMemo(() => resolveV2ModeConfig(), [])
  const defaultDependencies = useMemo(() => createWarehouseControllerDependencies(modeConfig), [modeConfig])
  const resolvedDependencies = useMemo<WarehouseControllerDependencies>(
    () => ({
      ...defaultDependencies,
      ...dependencies,
    }),
    [defaultDependencies, dependencies],
  )
  const screenProps = useWarehouseController(resolvedDependencies, {
    initialTab,
    initialFilter,
  })

  return (
    <div
      data-v2-component="warehouse-controller"
      data-v2-data-mode={resolvedDependencies.dataMode}
      data-v2-realtime-mode={modeConfig.realtimeMode}
    >
      <WarehouseScreen {...screenProps} />
    </div>
  )
}

export function createWarehouseControllerDependencies(
  modeConfig: V2ModeConfig = resolveV2ModeConfig(),
): WarehouseControllerDependencies {
  return {
    dataMode: modeConfig.dataMode,
    sessionStoragePort: createBrowserSessionStoragePort(),
    assetPort:
      modeConfig.dataMode === 'mock'
        ? createMockWarehouseAssetPort()
        : createRemoteWarehouseAssetPort(),
    assetJobUpdates:
      modeConfig.realtimeMode === 'local'
        ? createLocalAssetJobUpdates()
        : createRemoteAssetJobUpdates(),
    routePort: {
      navigateLogin: () => setPrototypeRoute('login'),
      navigateMain: () => setPrototypeRoute('main'),
      navigateWarehouse: (tab, filter) => {
        if (tab === 'component') {
          setPrototypeRoute('warehouse', { tab, filter: filter ?? 'all' })
          return
        }

        setPrototypeRoute('warehouse', { tab: 'avatar' })
      },
      navigateAvatarStudio: (assetId) => {
        if (assetId) {
          setPrototypeRoute('avatar-studio', { mode: 'edit', sourceAssetId: assetId })
          return
        }

        setPrototypeRoute('avatar-studio', { mode: 'new' })
      },
      navigateAssetStudio: (assetId) => {
        if (assetId) {
          setPrototypeRoute('asset-studio', { mode: 'edit', sourceAssetId: assetId })
          return
        }

        setPrototypeRoute('asset-studio', { mode: 'new' })
      },
    },
    getNowMs: () => Date.now(),
  }
}
