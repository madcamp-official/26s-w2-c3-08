import { useId, type HTMLAttributes, type ReactNode } from 'react'

import { cx } from '../../components/shared'
import styles from './GameShell.module.css'

export type GameShellState = 'default' | 'offline' | 'reconnecting' | 'locked'

export interface GameShellProps extends HTMLAttributes<HTMLElement> {
  title: string
  canvas: ReactNode
  topHud?: ReactNode
  leftShelf?: ReactNode
  rightToolDock?: ReactNode
  bottomOverlay?: ReactNode
  statusOverlay?: ReactNode
  toastLayer?: ReactNode
  state?: GameShellState
}

export function GameShell({
  title,
  canvas,
  topHud,
  leftShelf,
  rightToolDock,
  bottomOverlay,
  statusOverlay,
  toastLayer,
  state = 'default',
  className,
  ...props
}: GameShellProps) {
  const titleId = useId()

  return (
    <section
      className={cx(styles.shell, className)}
      aria-labelledby={titleId}
      data-v2-component="game-shell"
      data-v2-shell="game"
      data-v2-state={state}
      data-state={state}
      {...props}
    >
      <h1 id={titleId} className={styles.title}>
        {title}
      </h1>
      {topHud ? <div className={styles.topHud}>{topHud}</div> : null}
      {leftShelf ? (
        <aside className={styles.leftShelf} aria-label="게임 왼쪽 선반">
          {leftShelf}
        </aside>
      ) : null}
      <main className={styles.canvasRegion} aria-label="게임 캔버스 영역">
        {canvas}
      </main>
      {rightToolDock ? (
        <aside className={styles.rightToolDock} aria-label="게임 오른쪽 도구">
          {rightToolDock}
        </aside>
      ) : null}
      {bottomOverlay ? <div className={styles.bottomOverlay}>{bottomOverlay}</div> : null}
      {statusOverlay ? <div className={styles.statusOverlay}>{statusOverlay}</div> : null}
      {toastLayer ? <div className={styles.toastLayer}>{toastLayer}</div> : null}
    </section>
  )
}
