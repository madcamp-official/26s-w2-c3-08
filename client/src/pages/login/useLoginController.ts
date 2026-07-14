import { useCallback, useEffect, useRef, useState } from 'react'

import type { LoginScreenProps } from './LoginScreen'
import {
  bootLoginSession,
  isLoginBusy,
  submitLoginNickname,
  validateNickname,
  type LoginControllerRuntime,
  type LoginDataMode,
  type LoginRoutePort,
  type LoginViewState,
  type SessionPort,
  type StoragePort,
} from './loginControllerCore'

export interface UseLoginControllerOptions {
  dataMode: LoginDataMode
  sessionPort: SessionPort
  storagePort: StoragePort
  routePort: LoginRoutePort
}

export function useLoginController({
  dataMode,
  sessionPort,
  storagePort,
  routePort,
}: UseLoginControllerOptions): LoginScreenProps {
  const [viewState, setViewStateState] = useState<LoginViewState>('boot')
  const [nickname, setNickname] = useState('')
  const stateRef = useRef<LoginViewState>('boot')

  const setViewState = useCallback((nextState: LoginViewState) => {
    stateRef.current = nextState
    setViewStateState(nextState)
  }, [])

  useEffect(() => {
    let active = true
    const runtime = createRuntime({
      dataMode,
      sessionPort,
      storagePort,
      routePort,
      getCurrentState: () => stateRef.current,
      setViewState: (nextState) => {
        if (active) {
          setViewState(nextState)
        }
      },
      setNickname: (nextNickname) => {
        if (active) {
          setNickname(nextNickname)
        }
      },
    })

    void bootLoginSession(runtime)

    return () => {
      active = false
    }
  }, [dataMode, routePort, sessionPort, setViewState, storagePort])

  const handleNicknameChange = useCallback(
    (nextNickname: string) => {
      setNickname(nextNickname)

      if (isLoginBusy(stateRef.current)) {
        return
      }

      setViewState(validateNickname(nextNickname) ?? 'default')
    },
    [setViewState],
  )

  const handleSubmitNickname = useCallback(
    (submittedNickname: string) => {
      const runtime = createRuntime({
        dataMode,
        sessionPort,
        storagePort,
        routePort,
        getCurrentState: () => stateRef.current,
        setViewState,
        setNickname,
      })

      void submitLoginNickname(runtime, submittedNickname)
    },
    [dataMode, routePort, sessionPort, setViewState, storagePort],
  )

  return {
    state: viewState,
    nickname,
    onNicknameChange: handleNicknameChange,
    onSubmitNickname: handleSubmitNickname,
  }
}

function createRuntime(runtime: LoginControllerRuntime): LoginControllerRuntime {
  return runtime
}
