import { useMemo } from 'react'

import { resolveV2ModeConfig } from '../../infrastructure/config/modeConfig'
import { createRoomControllerDependencies } from '../lobby/LobbyController'
import { RoomScreen } from './RoomScreen'
import { useRoomController, type RoomControllerDependencies } from './useRoomController'

export interface RoomControllerProps {
  roomId: string
  dependencies?: Partial<RoomControllerDependencies>
}

export function RoomController({ roomId, dependencies }: RoomControllerProps) {
  const modeConfig = useMemo(() => resolveV2ModeConfig(), [])
  const defaultDependencies = useMemo(() => createRoomControllerDependencies(modeConfig), [modeConfig])
  const resolvedDependencies = useMemo<RoomControllerDependencies>(
    () => ({
      ...defaultDependencies,
      ...dependencies,
    }),
    [defaultDependencies, dependencies],
  )
  const screenProps = useRoomController(resolvedDependencies, roomId)

  return (
    <div
      data-v2-component="room-controller"
      data-v2-data-mode={resolvedDependencies.dataMode}
      data-v2-realtime-mode={modeConfig.realtimeMode}
    >
      <RoomScreen {...screenProps} />
    </div>
  )
}
