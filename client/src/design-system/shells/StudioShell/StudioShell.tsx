import { useId, type HTMLAttributes, type ReactNode } from 'react'

import { cx } from '../../components/shared'
import styles from './StudioShell.module.css'

export type StudioPanelState = 'expanded' | 'collapsed' | 'resizing'

export interface StudioShellProps extends HTMLAttributes<HTMLElement> {
  title: string
  leftPanel: ReactNode
  center: ReactNode
  rightPanel: ReactNode
  leftPanelState?: StudioPanelState
  rightPanelState?: StudioPanelState
  topBar?: ReactNode
  statusLayer?: ReactNode
  toastLayer?: ReactNode
}

export function StudioShell({
  title,
  leftPanel,
  center,
  rightPanel,
  leftPanelState = 'expanded',
  rightPanelState = 'expanded',
  topBar,
  statusLayer,
  toastLayer,
  className,
  ...props
}: StudioShellProps) {
  const titleId = useId()

  return (
    <section
      className={cx(styles.shell, className)}
      aria-labelledby={titleId}
      data-v2-component="studio-shell"
      data-v2-shell="studio"
      data-v2-state={getStudioState(leftPanelState, rightPanelState)}
      data-left-panel-state={leftPanelState}
      data-right-panel-state={rightPanelState}
      {...props}
    >
      <header className={styles.topBar}>
        <div>
          <p>Studio Shell</p>
          <h1 id={titleId}>{title}</h1>
        </div>
        {topBar ? <div className={styles.topActions}>{topBar}</div> : null}
      </header>
      <div className={styles.workspace}>
        <aside
          className={styles.panel}
          aria-label="왼쪽 스튜디오 패널"
          data-side="left"
          data-state={leftPanelState}
        >
          <div className={styles.panelContent} aria-hidden={leftPanelState === 'collapsed'}>
            {leftPanel}
          </div>
          {leftPanelState === 'collapsed' ? <span className={styles.collapsedLabel}>왼쪽 패널</span> : null}
          {leftPanelState === 'resizing' ? <span className={styles.resizeHandle} aria-hidden="true" /> : null}
        </aside>
        <main className={styles.center} aria-label="스튜디오 작업 영역">
          {center}
        </main>
        <aside
          className={styles.panel}
          aria-label="오른쪽 스튜디오 패널"
          data-side="right"
          data-state={rightPanelState}
        >
          <div className={styles.panelContent} aria-hidden={rightPanelState === 'collapsed'}>
            {rightPanel}
          </div>
          {rightPanelState === 'collapsed' ? <span className={styles.collapsedLabel}>오른쪽 패널</span> : null}
          {rightPanelState === 'resizing' ? <span className={styles.resizeHandle} aria-hidden="true" /> : null}
        </aside>
      </div>
      {statusLayer ? <div className={styles.statusLayer}>{statusLayer}</div> : null}
      {toastLayer ? <div className={styles.toastLayer}>{toastLayer}</div> : null}
    </section>
  )
}

function getStudioState(leftPanelState: StudioPanelState, rightPanelState: StudioPanelState) {
  if (leftPanelState === 'resizing' || rightPanelState === 'resizing') {
    return 'resizing'
  }

  if (leftPanelState === 'collapsed') {
    return 'left_collapsed'
  }

  if (rightPanelState === 'collapsed') {
    return 'right_collapsed'
  }

  return 'expanded'
}
