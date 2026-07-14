import { useMemo } from 'react'

import { setPrototypeRoute } from '../../app/navigation/prototypeRouter'
import { resolveV2ModeConfig, type V2ModeConfig } from '../../infrastructure/config/modeConfig'
import { createAvatarStudioDrawingPort } from '../../infrastructure/avatar-studio/avatarStudioDrawingPort'
import { createBrowserAvatarStudioLayoutStorage } from '../../infrastructure/avatar-studio/browserAvatarStudioLayoutStorage'
import { createMockAvatarStudioAssetPort } from '../../infrastructure/avatar-studio/mockAvatarStudioAssetPort'
import { createRemoteAvatarStudioAssetPort } from '../../infrastructure/avatar-studio/remoteAvatarStudioAssetPort'
import { createBrowserSessionStoragePort } from '../../infrastructure/session/browserSessionStoragePort'
import { AvatarStudioScreen } from './AvatarStudioScreen'
import {
  useAvatarStudioController,
  type AvatarStudioControllerDependencies,
  type AvatarStudioRouteState,
} from './useAvatarStudioController'

export interface AvatarStudioControllerProps {
  routeState: AvatarStudioRouteState
  dependencies?: Partial<AvatarStudioControllerDependencies>
}

export function AvatarStudioController({
  routeState,
  dependencies,
}: AvatarStudioControllerProps) {
  const modeConfig = useMemo(() => resolveV2ModeConfig(), [])
  const defaultDependencies = useMemo(
    () => createAvatarStudioControllerDependencies(modeConfig),
    [modeConfig],
  )
  const resolvedDependencies = useMemo<AvatarStudioControllerDependencies>(
    () => ({
      ...defaultDependencies,
      ...dependencies,
    }),
    [defaultDependencies, dependencies],
  )
  const screenProps = useAvatarStudioController(resolvedDependencies, routeState)

  return (
    <div
      data-v2-component="avatar-studio-controller"
      data-v2-data-mode={resolvedDependencies.dataMode}
    >
      <AvatarStudioScreen {...screenProps} />
    </div>
  )
}

export function createAvatarStudioControllerDependencies(
  modeConfig: V2ModeConfig = resolveV2ModeConfig(),
): AvatarStudioControllerDependencies {
  return {
    dataMode: modeConfig.dataMode,
    sessionStoragePort: createBrowserSessionStoragePort(),
    layoutStorage: createBrowserAvatarStudioLayoutStorage(),
    assetPort:
      modeConfig.dataMode === 'mock'
        ? createMockAvatarStudioAssetPort()
        : createRemoteAvatarStudioAssetPort(),
    drawingPort: createAvatarStudioDrawingPort(),
    routePort: {
      navigateLogin: () => setPrototypeRoute('login'),
      navigateMain: () => setPrototypeRoute('main'),
      navigateWarehouseAvatar: () => setPrototypeRoute('warehouse', { tab: 'avatar' }),
    },
  }
}
