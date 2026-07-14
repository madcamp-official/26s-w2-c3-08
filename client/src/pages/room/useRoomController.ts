import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { LobbyScreenProps } from '../lobby/LobbyScreen'
import type { RoomScreenProps } from './RoomScreen'
import {
  bootLobbyController,
  bootRoomController,
  createInitialRoomControllerState,
  createLobbyScreenProps,
  createRoomScreenProps,
  type RoomControllerRuntime,
  type RoomControllerState,
} from './roomControllerCore'

export type RoomControllerDependencies = Omit<
  RoomControllerRuntime,
  'getState' | 'setState'
>

export function useLobbyController(
  dependencies: RoomControllerDependencies,
): LobbyScreenProps {
  const runtime = useRoomControllerRuntime(dependencies)

  useEffect(() => {
    let active = true
    const guardedRuntime = createGuardedRuntime(runtime, () => active)

    void bootLobbyController(guardedRuntime)

    return () => {
      active = false
      dependencies.roomRealtime.disconnect()
    }
  }, [dependencies.roomRealtime, runtime])

  return createLobbyScreenProps(runtime)
}

export function useRoomController(
  dependencies: RoomControllerDependencies,
  roomId: string,
): RoomScreenProps {
  const runtime = useRoomControllerRuntime(dependencies, roomId)

  useEffect(() => {
    runtime.setState((state) => ({
      ...state,
      currentRoomId: roomId,
      currentRoom: state.currentRoom?.roomId === roomId ? state.currentRoom : null,
      roomStateOverride: 'loading',
    }))
  }, [roomId, runtime])

  useEffect(() => {
    let active = true
    const guardedRuntime = createGuardedRuntime(runtime, () => active)

    void bootRoomController(guardedRuntime, roomId)

    return () => {
      active = false
      dependencies.roomRealtime.disconnect()
    }
  }, [dependencies.roomRealtime, roomId, runtime])

  return createRoomScreenProps(runtime)
}

function useRoomControllerRuntime(
  dependencies: RoomControllerDependencies,
  roomId?: string,
): RoomControllerRuntime {
  const [controllerState, setControllerState] = useState(() =>
    createInitialRoomControllerState(roomId),
  )
  const stateRef = useRef(controllerState)

  const setState = useCallback((updater: (state: RoomControllerState) => RoomControllerState) => {
    setControllerState((current) => {
      const nextState = updater(current)
      stateRef.current = nextState
      return nextState
    })
  }, [])

  useEffect(() => {
    stateRef.current = controllerState
  }, [controllerState])

  return useMemo<RoomControllerRuntime>(
    () => ({
      ...dependencies,
      getState: () => stateRef.current,
      setState,
    }),
    [dependencies, setState],
  )
}

function createGuardedRuntime(
  runtime: RoomControllerRuntime,
  isActive: () => boolean,
): RoomControllerRuntime {
  return {
    ...runtime,
    setState: (updater) => {
      if (isActive()) {
        runtime.setState(updater)
      }
    },
  }
}
