import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { WarehouseScreenProps } from './WarehouseScreen'
import {
  bootWarehouseController,
  createInitialWarehouseControllerState,
  createWarehouseScreenProps,
  handleWarehouseAssetJobEvent,
  handleWarehouseConnectionEvent,
  loadWarehouseAssets,
  tickWarehouseCooldown,
  updateWarehouseRouteSelection,
  type AssetJobUpdateEvent,
  type WarehouseControllerRuntime,
  type WarehouseControllerState,
} from './warehouseControllerCore'

export type WarehouseControllerDependencies = Omit<
  WarehouseControllerRuntime,
  'getState' | 'setState'
>

export interface WarehouseControllerRouteState {
  initialTab?: WarehouseControllerState['selectedTab']
  initialFilter?: WarehouseControllerState['selectedFilter']
}

export function useWarehouseController(
  dependencies: WarehouseControllerDependencies,
  routeState: WarehouseControllerRouteState = {},
): WarehouseScreenProps {
  const [controllerState, setControllerState] = useState(() =>
    createInitialWarehouseControllerState(
      routeState.initialTab,
      routeState.initialFilter,
      dependencies.getNowMs(),
    ),
  )
  const stateRef = useRef(controllerState)

  const setState = useCallback((updater: (state: WarehouseControllerState) => WarehouseControllerState) => {
    setControllerState((current) => {
      const nextState = updater(current)
      stateRef.current = nextState
      return nextState
    })
  }, [])

  useEffect(() => {
    stateRef.current = controllerState
  }, [controllerState])

  const runtime = useMemo<WarehouseControllerRuntime>(
    () => ({
      ...dependencies,
      getState: () => stateRef.current,
      setState,
    }),
    [dependencies, setState],
  )

  useEffect(() => {
    updateWarehouseRouteSelection(
      runtime,
      routeState.initialTab ?? 'component',
      routeState.initialFilter ?? 'all',
    )
  }, [routeState.initialFilter, routeState.initialTab, runtime])

  useEffect(() => {
    let active = true
    const guardedRuntime = createGuardedRuntime(runtime, () => active)

    void bootWarehouseController(guardedRuntime)

    return () => {
      active = false
    }
  }, [runtime])

  useEffect(() => {
    let active = true
    const guardedRuntime = createGuardedRuntime(runtime, () => active)
    const unsubscribe = dependencies.assetJobUpdates.subscribe((event) => {
      if (isAssetJobUpdateEvent(event)) {
        handleWarehouseAssetJobEvent(guardedRuntime, event)
        return
      }

      const result = handleWarehouseConnectionEvent(guardedRuntime, event)

      if (result.shouldRefresh) {
        void loadWarehouseAssets(guardedRuntime)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [dependencies.assetJobUpdates, runtime])

  useEffect(() => {
    let active = true
    const guardedRuntime = createGuardedRuntime(runtime, () => active)
    const intervalId = window.setInterval(() => {
      tickWarehouseCooldown(guardedRuntime, dependencies.getNowMs())
    }, 1000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [dependencies.getNowMs, runtime])

  return createWarehouseScreenProps(runtime)
}

function createGuardedRuntime(
  runtime: WarehouseControllerRuntime,
  isActive: () => boolean,
): WarehouseControllerRuntime {
  return {
    ...runtime,
    setState: (updater) => {
      if (isActive()) {
        runtime.setState(updater)
      }
    },
  }
}

function isAssetJobUpdateEvent(event: unknown): event is AssetJobUpdateEvent {
  return typeof event === 'object' && event !== null && 'assetId' in event
}
