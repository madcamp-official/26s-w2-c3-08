import type { RealtimeConnectionStatus, Session, TypedApiError } from 'shared/schemas'

export type V2RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'error'

export type SocketIoListener = (...args: unknown[]) => void

export interface SocketIoClientLike {
  readonly connected?: boolean
  readonly io?: {
    on(eventName: string, listener: SocketIoListener): void
    off(eventName: string, listener: SocketIoListener): void
  }
  on(eventName: string, listener: SocketIoListener): void
  off(eventName: string, listener: SocketIoListener): void
  emit(eventName: string, payload?: unknown): void
  connect(): void
  disconnect(): void
}

export type SocketIoClientFactory = (
  url: string,
  options: SocketIoClientOptions,
) => SocketIoClientLike

export interface SocketIoClientOptions {
  autoConnect: boolean
  transports: ['websocket', 'polling']
  auth: {
    userId: string
    token: string
  }
}

export interface SocketIoTransportOptions {
  url?: string
  socketFactory?: SocketIoClientFactory
}

export interface SocketIoTransport {
  getStatus(): V2RealtimeConnectionStatus
  connect(session: Session): Promise<{ ok: true } | { ok: false; error: TypedApiError }>
  disconnect(): void
  emit(eventName: string, payload?: unknown): void
  on(eventName: string, listener: SocketIoListener): () => void
  onStatusChange(listener: (status: V2RealtimeConnectionStatus) => void): () => void
}

export function createSocketIoTransport({
  url = getDefaultSocketIoUrl(),
  socketFactory,
}: SocketIoTransportOptions = {}): SocketIoTransport {
  let socket: SocketIoClientLike | null = null
  let status: V2RealtimeConnectionStatus = socketFactory ? 'offline' : 'error'
  const statusListeners = new Set<(status: V2RealtimeConnectionStatus) => void>()
  const socketListeners = new Map<string, Set<SocketIoListener>>()
  const disposers: Array<() => void> = []
  let manuallyDisconnected = false

  function setStatus(nextStatus: V2RealtimeConnectionStatus) {
    status = nextStatus

    for (const listener of statusListeners) {
      listener(nextStatus)
    }
  }

  function bindSocket(nextSocket: SocketIoClientLike) {
    const connectListener = () => setStatus('connected')
    const disconnectListener = () => {
      setStatus(manuallyDisconnected ? 'offline' : 'reconnecting')
    }
    const connectErrorListener = () => setStatus('error')
    const reconnectAttemptListener = () => setStatus('reconnecting')
    const reconnectListener = () => setStatus('connected')
    const reconnectErrorListener = () => setStatus('reconnecting')
    const reconnectFailedListener = () => setStatus('error')

    nextSocket.on('connect', connectListener)
    nextSocket.on('disconnect', disconnectListener)
    nextSocket.on('connect_error', connectErrorListener)
    disposers.push(() => nextSocket.off('connect', connectListener))
    disposers.push(() => nextSocket.off('disconnect', disconnectListener))
    disposers.push(() => nextSocket.off('connect_error', connectErrorListener))

    if (nextSocket.io) {
      nextSocket.io.on('reconnect_attempt', reconnectAttemptListener)
      nextSocket.io.on('reconnect', reconnectListener)
      nextSocket.io.on('reconnect_error', reconnectErrorListener)
      nextSocket.io.on('reconnect_failed', reconnectFailedListener)
      disposers.push(() => nextSocket.io?.off('reconnect_attempt', reconnectAttemptListener))
      disposers.push(() => nextSocket.io?.off('reconnect', reconnectListener))
      disposers.push(() => nextSocket.io?.off('reconnect_error', reconnectErrorListener))
      disposers.push(() => nextSocket.io?.off('reconnect_failed', reconnectFailedListener))
    }

    for (const [eventName, listeners] of socketListeners) {
      for (const listener of listeners) {
        nextSocket.on(eventName, listener)
      }
    }
  }

  function unbindSocket() {
    for (const dispose of disposers.splice(0)) {
      dispose()
    }
  }

  return {
    getStatus() {
      return status
    },
    async connect(session) {
      if (!socketFactory) {
        const error = createRealtimeError(
          'SOCKET_IO_CLIENT_MISSING',
          'socket.io-client dependency is required for VITE_REALTIME_MODE=remote.',
          false,
        )
        setStatus('error')
        return { ok: false, error }
      }

      manuallyDisconnected = false
      unbindSocket()
      socket?.disconnect()
      setStatus('connecting')
      socket = socketFactory(url, {
        autoConnect: false,
        transports: ['websocket', 'polling'],
        auth: {
          userId: session.id,
          token: session.token,
        },
      })
      bindSocket(socket)
      socket.connect()

      return { ok: true }
    },
    disconnect() {
      manuallyDisconnected = true
      unbindSocket()
      socket?.disconnect()
      socket = null
      setStatus('offline')
    },
    emit(eventName, payload) {
      socket?.emit(eventName, payload)
    },
    on(eventName, listener) {
      const listeners = socketListeners.get(eventName) ?? new Set<SocketIoListener>()

      listeners.add(listener)
      socketListeners.set(eventName, listeners)
      socket?.on(eventName, listener)

      return () => {
        listeners.delete(listener)
        socket?.off(eventName, listener)
      }
    },
    onStatusChange(listener) {
      statusListeners.add(listener)

      return () => {
        statusListeners.delete(listener)
      }
    },
  }
}

export function toSharedRealtimeStatus(
  status: V2RealtimeConnectionStatus,
): RealtimeConnectionStatus {
  return status
}

export function createRealtimeError(
  code: string,
  message: string,
  retryable: boolean,
): TypedApiError {
  return {
    kind: 'server_unavailable',
    code,
    message,
    retryable,
    source: 'realtime',
  }
}

function getDefaultSocketIoUrl() {
  const env = (import.meta.env ?? {}) as Partial<ImportMetaEnv> & {
    VITE_SOCKET_IO_URL?: string
  }

  if (env.VITE_SOCKET_IO_URL) {
    return env.VITE_SOCKET_IO_URL
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'http://localhost:4000'
}
