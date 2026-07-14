import { io } from 'socket.io-client'

import type {
  SocketIoClientFactory,
  SocketIoClientLike,
  SocketIoListener,
} from './socketIoTransport'

export const createProductionSocketIoClient: SocketIoClientFactory = (url, options) => {
  const socket = io(url, {
    autoConnect: options.autoConnect,
    transports: options.transports,
    auth: options.auth,
  })

  return createSocketIoClientLike(socket)
}

function createSocketIoClientLike(socket: ReturnType<typeof io>): SocketIoClientLike {
  const client = socket as unknown as SocketIoClientLike

  return {
    get connected() {
      return client.connected
    },
    io: client.io
      ? {
          on(eventName, listener) {
            client.io?.on(eventName, listener)
          },
          off(eventName, listener) {
            client.io?.off(eventName, listener)
          },
        }
      : undefined,
    on(eventName: string, listener: SocketIoListener) {
      client.on(eventName, listener)
    },
    off(eventName: string, listener: SocketIoListener) {
      client.off(eventName, listener)
    },
    emit(eventName: string, payload?: unknown) {
      client.emit(eventName, payload)
    },
    connect() {
      client.connect()
    },
    disconnect() {
      client.disconnect()
    },
  }
}
