import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { PrototypeRoute } from '../../app/navigation/prototypeRouter'
import type { AvatarStudioScreenProps } from './AvatarStudioScreen'
import {
  bootAvatarStudioController,
  createAvatarStudioScreenProps,
  createInitialAvatarStudioControllerState,
  type AvatarStudioControllerRuntime,
  type AvatarStudioControllerState,
} from './avatarStudioControllerCore'

export type AvatarStudioControllerDependencies = Omit<
  AvatarStudioControllerRuntime,
  'getState' | 'setState'
>

export type AvatarStudioRouteState = Extract<PrototypeRoute, { kind: 'avatarStudio' }>['contractRoute']

export function useAvatarStudioController(
  dependencies: AvatarStudioControllerDependencies,
  routeState: AvatarStudioRouteState,
): AvatarStudioScreenProps {
  const [controllerState, setControllerState] = useState(() =>
    createInitialAvatarStudioControllerState(dependencies.layoutStorage.loadLayout()),
  )
  const stateRef = useRef(controllerState)

  const setState = useCallback((updater: (state: AvatarStudioControllerState) => AvatarStudioControllerState) => {
    setControllerState((current) => {
      const nextState = updater(current)
      stateRef.current = nextState
      return nextState
    })
  }, [])

  useEffect(() => {
    stateRef.current = controllerState
  }, [controllerState])

  const runtime = useMemo<AvatarStudioControllerRuntime>(
    () => ({
      ...dependencies,
      getState: () => stateRef.current,
      setState,
    }),
    [dependencies, setState],
  )

  useEffect(() => {
    let active = true

    void bootAvatarStudioController(
      {
        ...runtime,
        setState: (updater) => {
          if (active) {
            runtime.setState(updater)
          }
        },
      },
      {
        mode: routeState.mode,
        sourceAssetId: routeState.sourceAssetId,
      },
    )

    return () => {
      active = false
    }
  }, [routeState.mode, routeState.sourceAssetId, runtime])

  return createAvatarStudioScreenProps(runtime)
}
