import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { MainScreenProps } from './MainScreen'
import {
  bootMainController,
  createInitialMainControllerState,
  createMainScreenProps,
  type MainControllerRuntime,
  type MainControllerState,
} from './mainControllerCore'

export type MainControllerDependencies = Omit<
  MainControllerRuntime,
  'getState' | 'setState'
>

export function useMainController(dependencies: MainControllerDependencies): MainScreenProps {
  const [controllerState, setControllerState] = useState(() =>
    createInitialMainControllerState(dependencies.settingsStoragePort.loadSettings()),
  )
  const stateRef = useRef(controllerState)

  const setState = useCallback((updater: (state: MainControllerState) => MainControllerState) => {
    setControllerState((current) => {
      const nextState = updater(current)
      stateRef.current = nextState
      return nextState
    })
  }, [])

  useEffect(() => {
    stateRef.current = controllerState
  }, [controllerState])

  const runtime = useMemo<MainControllerRuntime>(
    () => ({
      ...dependencies,
      getState: () => stateRef.current,
      setState,
    }),
    [dependencies, setState],
  )

  useEffect(() => {
    let active = true

    void bootMainController({
      ...runtime,
      setState: (updater) => {
        if (active) {
          runtime.setState(updater)
        }
      },
    })

    return () => {
      active = false
    }
  }, [runtime])

  return createMainScreenProps(runtime)
}
