import type {
  AssetJobUpdates,
  GameRealtime,
  RoomRealtime,
} from '../../domain/ports'
import type { V2ModeConfig } from '../config/modeConfig'
import { createBroadcastChannelRealtimeAdapters, type BroadcastChannelRealtimeOptions } from './broadcastChannelLocalAdapters'
import {
  createSocketIoRemoteRealtimeAdapters,
  type SocketIoRemoteRealtimeAdapters,
} from './socketIoRemoteAdapters'
import type { SocketIoTransportOptions } from './socketIoTransport'

export interface V2RealtimeAdapters {
  roomRealtime: RoomRealtime
  gameRealtime: GameRealtime
  assetJobUpdates: AssetJobUpdates
}

export interface CreateV2RealtimeAdaptersOptions {
  socketIo?: SocketIoTransportOptions
  broadcastChannel?: BroadcastChannelRealtimeOptions
}

export function createV2RealtimeAdapters(
  modeConfig: Pick<V2ModeConfig, 'realtimeMode'>,
  options: CreateV2RealtimeAdaptersOptions = {},
): V2RealtimeAdapters {
  if (modeConfig.realtimeMode === 'remote') {
    const adapters: SocketIoRemoteRealtimeAdapters = createSocketIoRemoteRealtimeAdapters(options.socketIo)

    return {
      roomRealtime: adapters.roomRealtime,
      gameRealtime: adapters.gameRealtime,
      assetJobUpdates: adapters.assetJobUpdates,
    }
  }

  return createBroadcastChannelRealtimeAdapters(options.broadcastChannel)
}
