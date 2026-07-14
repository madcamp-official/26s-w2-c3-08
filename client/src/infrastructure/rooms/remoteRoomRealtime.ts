import type { RealtimeRoomSnapshot } from 'shared/schemas'
import type { LoginSession } from '../../pages/login/loginControllerCore'
import type { RoomConnectionStatus } from '../../pages/room/RoomScreen'
import type {
  RoomRealtime,
  RoomRealtimeHandlers,
  RoomRealtimeSnapshot,
} from '../../pages/room/roomControllerCore'
import { createSocketIoRemoteRealtimeAdapters } from '../realtime/socketIoRemoteAdapters'
import type { V2RealtimeConnectionStatus } from '../realtime/socketIoTransport'

interface RemoteRoomRealtimeOptions {
  adapters?: ReturnType<typeof createSocketIoRemoteRealtimeAdapters>
}

export function createRemoteRoomRealtime({
  adapters = createSocketIoRemoteRealtimeAdapters(),
}: RemoteRoomRealtimeOptions = {}): RoomRealtime {
  return {
    getConnectionStatus() {
      return mapRemoteStatus(adapters.transport.getStatus())
    },
    async connect(session: LoginSession, handlers: RoomRealtimeHandlers) {
      const unsubscribeStatus = adapters.transport.onStatusChange((status) => {
        const mappedStatus = mapRemoteStatus(status)

        handlers.onConnectionStatus?.(mappedStatus.status, mappedStatus.message)
      })
      const result = await adapters.roomRealtime.connect(
        {
          id: session.id,
          nickname: session.nickname,
          token: session.token,
          avatarAssetId: session.avatarAssetId ?? null,
        },
        {
          onStatusChange: (status) => {
            const mappedStatus = mapSharedStatus(status)

            handlers.onConnectionStatus?.(mappedStatus.status, mappedStatus.message)
          },
          onRoomJoined: (snapshot) => handlers.onRoomJoined?.(normalizeRoomSnapshot(snapshot)),
          onRoomStateChanged: (snapshot) => handlers.onRoomStateChanged?.(normalizeRoomSnapshot(snapshot)),
          onPhaseChanged: (payload) => handlers.onPhaseChanged?.(payload),
        },
      )

      if (!result.ok) {
        unsubscribeStatus()
        return {
          ok: false,
          error: {
            kind: 'server_unavailable',
            message: result.error.message,
            retryable: result.error.retryable,
          },
        }
      }

      return { ok: true, value: undefined }
    },
    disconnect() {
      adapters.roomRealtime.disconnect()
    },
    joinRoom(payload) {
      adapters.roomRealtime.joinRoom(payload)
    },
    leaveRoom(payload) {
      adapters.roomRealtime.leaveRoom(payload)
    },
    setReady(payload) {
      adapters.roomRealtime.setReady(payload)
    },
    startRoom(payload) {
      adapters.roomRealtime.startRoom(payload)
    },
  }
}

function normalizeRoomSnapshot(snapshot: RealtimeRoomSnapshot): RoomRealtimeSnapshot {
  return {
    roomId: snapshot.roomId,
    phase: snapshot.phase,
    phaseEndsAt: snapshot.phaseEndsAt,
    players: snapshot.players.map((player) => ({
      userId: player.userId,
      nickname: player.nickname,
      isHost: player.isHost,
      isReady: player.isReady,
    })),
  }
}

function mapRemoteStatus(
  status: V2RealtimeConnectionStatus,
): { status: RoomConnectionStatus; message?: string } {
  if (status === 'connected') {
    return { status: 'online' }
  }

  if (status === 'connecting' || status === 'reconnecting') {
    return {
      status: 'reconnecting',
      message: '방 상태를 다시 연결하고 있어요.',
    }
  }

  if (status === 'offline') {
    return {
      status: 'offline',
      message: '방 실시간 연결이 끊어졌어요.',
    }
  }

  return {
    status: 'error',
    message: '방 실시간 연결을 사용할 수 없어요.',
  }
}

function mapSharedStatus(status: string): { status: RoomConnectionStatus; message?: string } {
  if (status === 'connected' || status === 'local') {
    return { status: 'online' }
  }

  if (status === 'connecting' || status === 'reconnecting') {
    return {
      status: 'reconnecting',
      message: '방 상태를 다시 연결하고 있어요.',
    }
  }

  if (status === 'offline') {
    return {
      status: 'offline',
      message: '방 실시간 연결이 끊어졌어요.',
    }
  }

  return {
    status: 'error',
    message: '방 실시간 연결을 사용할 수 없어요.',
  }
}
