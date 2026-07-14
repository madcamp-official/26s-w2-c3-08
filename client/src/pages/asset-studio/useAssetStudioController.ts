import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { PrototypeRoute } from '../../app/navigation/prototypeRouter'
import type { AssetStudioScreenProps } from './AssetStudioScreen'
import {
  bootAssetStudioController,
  createAssetStudioScreenProps,
  createInitialAssetStudioControllerState,
  type AssetStudioControllerRuntime,
  type AssetStudioControllerState,
} from './assetStudioControllerCore'

export type AssetStudioControllerDependencies = Omit<
  AssetStudioControllerRuntime,
  'getState' | 'setState'
>

export type AssetStudioRouteState = Extract<PrototypeRoute, { kind: 'assetStudio' }>['contractRoute']

export function useAssetStudioController(
  dependencies: AssetStudioControllerDependencies,
  routeState: AssetStudioRouteState,
): AssetStudioScreenProps {
  const [controllerState, setControllerState] = useState(() =>
    createInitialAssetStudioControllerState(dependencies.layoutStorage.loadLayout()),
  )
  const stateRef = useRef(controllerState)

  const setState = useCallback((updater: (state: AssetStudioControllerState) => AssetStudioControllerState) => {
    setControllerState((current) => {
      const nextState = updater(current)
      stateRef.current = nextState
      return nextState
    })
  }, [])

  useEffect(() => {
    stateRef.current = controllerState
  }, [controllerState])

  const runtime = useMemo<AssetStudioControllerRuntime>(
    () => ({
      ...dependencies,
      getState: () => stateRef.current,
      setState,
    }),
    [dependencies, setState],
  )

  useEffect(() => {
    let active = true

    void bootAssetStudioController(
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

  return createAssetStudioScreenProps(runtime)
}
