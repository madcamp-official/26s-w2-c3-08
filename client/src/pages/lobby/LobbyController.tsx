import { useMemo } from 'react'

import { setPrototypeRoute } from '../../app/navigation/prototypeRouter'
import { resolveV2ModeConfig, type V2ModeConfig } from '../../infrastructure/config/modeConfig'
import { createLocalRoomRealtime } from '../../infrastructure/rooms/localRoomRealtime'
import { createMockRoomPort } from '../../infrastructure/rooms/mockRoomPort'
import { createRemoteRoomPort } from '../../infrastructure/rooms/remoteRoomPort'
import { createRemoteRoomRealtime } from '../../infrastructure/rooms/remoteRoomRealtime'
import { createBrowserSessionStoragePort } from '../../infrastructure/session/browserSessionStoragePort'
import { LobbyScreen } from './LobbyScreen'
import { useLobbyController, type RoomControllerDependencies } from '../room/useRoomController'

export interface LobbyControllerProps {
  dependencies?: Partial<RoomControllerDependencies>
}

export function LobbyController({ dependencies }: LobbyControllerProps) {
  const modeConfig = useMemo(() => resolveV2ModeConfig(), [])
  const defaultDependencies = useMemo(() => createRoomControllerDependencies(modeConfig), [modeConfig])
  const resolvedDependencies = useMemo<RoomControllerDependencies>(
    () => ({
      ...defaultDependencies,
      ...dependencies,
    }),
    [defaultDependencies, dependencies],
  )
  const screenProps = useLobbyController(resolvedDependencies)

  return (
    <div
      data-v2-component="lobby-controller"
      data-v2-data-mode={resolvedDependencies.dataMode}
      data-v2-realtime-mode={modeConfig.realtimeMode}
    >
      <LobbyScreen {...screenProps} />
    </div>
  )
}

export function createRoomControllerDependencies(
  modeConfig: V2ModeConfig = resolveV2ModeConfig(),
): RoomControllerDependencies {
  return {
    dataMode: modeConfig.dataMode,
    sessionStoragePort: createBrowserSessionStoragePort(),
    roomPort: modeConfig.dataMode === 'mock' ? createMockRoomPort() : createRemoteRoomPort(),
    roomRealtime:
      modeConfig.realtimeMode === 'local'
        ? createLocalRoomRealtime()
        : createRemoteRoomRealtime(),
    routePort: {
      navigateLogin: () => setPrototypeRoute('login'),
      navigateMain: () => setPrototypeRoute('main'),
      navigateLobby: () => setPrototypeRoute('lobby'),
      navigateRoom: (roomId) => setPrototypeRoute('room', { roomId }),
      navigateMapBuild: (roomId) => setPrototypeRoute('map-build', { roomId }),
    },
  }
}
