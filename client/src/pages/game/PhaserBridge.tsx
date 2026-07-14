import { useEffect, useRef, useState, type ReactNode } from 'react'

import styles from './PhaserBridge.module.css'

export type PhaserBridgeKind = 'map-editor' | 'playtest' | 'race'
export type PhaserBridgeStatus = 'mounting' | 'mounted' | 'duplicate-prevented' | 'unmounted'

export type PhaserBridgeLifecycleEvent =
  | {
      type: 'mounted'
      bridgeId: string
      kind: PhaserBridgeKind
      routeKey: string
    }
  | {
      type: 'unmounted'
      bridgeId: string
      kind: PhaserBridgeKind
      routeKey: string
    }
  | {
      type: 'duplicate-prevented'
      bridgeId: string
      kind: PhaserBridgeKind
      routeKey: string
    }
  | {
      type: 'resized'
      bridgeId: string
      kind: PhaserBridgeKind
      routeKey: string
      width: number
      height: number
    }

export interface PhaserBridgeProps {
  bridgeId: string
  routeKey: string
  kind: PhaserBridgeKind
  label: string
  summary: string
  children: ReactNode
  onLifecycleEvent?: (event: PhaserBridgeLifecycleEvent) => void
}

const activeBridgeIds = new Set<string>()

export function PhaserBridge({
  bridgeId,
  routeKey,
  kind,
  label,
  summary,
  children,
  onLifecycleEvent,
}: PhaserBridgeProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<PhaserBridgeStatus>('mounting')

  useEffect(() => {
    const root = rootRef.current

    if (activeBridgeIds.has(bridgeId)) {
      setStatus('duplicate-prevented')
      onLifecycleEvent?.({ type: 'duplicate-prevented', bridgeId, kind, routeKey })
      return undefined
    }

    activeBridgeIds.add(bridgeId)
    setStatus('mounted')
    onLifecycleEvent?.({ type: 'mounted', bridgeId, kind, routeKey })

    const emitResize = () => {
      const rect = root?.getBoundingClientRect()

      if (!rect) {
        return
      }

      onLifecycleEvent?.({
        type: 'resized',
        bridgeId,
        kind,
        routeKey,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
    }

    const resizeObserver =
      root && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(emitResize)
        : null

    if (root && resizeObserver) {
      resizeObserver.observe(root)
    }

    window.addEventListener('resize', emitResize)
    emitResize()

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', emitResize)
      activeBridgeIds.delete(bridgeId)
      onLifecycleEvent?.({ type: 'unmounted', bridgeId, kind, routeKey })
    }
  }, [bridgeId, kind, onLifecycleEvent, routeKey])

  return (
    <section
      ref={rootRef}
      className={styles.bridge}
      aria-label={label}
      data-v2-component="phaser-bridge"
      data-v2-state={status}
      data-v2-phaser-kind={kind}
      data-v2-bridge-id={bridgeId}
      data-v2-route-key={routeKey}
    >
      <div className={styles.status} role="status" aria-live="polite">
        <strong>{label}</strong>
        <span>{summary}</span>
      </div>
      <div className={styles.canvasFrame} data-v2-component="phaser-canvas-frame">
        {status === 'mounted' ? children : null}
        {status === 'duplicate-prevented' ? (
          <div className={styles.duplicateNotice} role="alert">
            같은 Phaser bridge가 이미 실행 중입니다. 기존 캔버스를 정리한 뒤 다시 열어주세요.
          </div>
        ) : null}
        {status === 'mounting' ? (
          <div className={styles.loadingNotice} role="status">
            Phaser 캔버스를 준비하고 있어요.
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function getActivePhaserBridgeCount() {
  return activeBridgeIds.size
}
