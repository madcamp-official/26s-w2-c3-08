import { useId, type HTMLAttributes, type ReactNode } from 'react'

import { cx } from '../../components/shared'
import styles from './LauncherShell.module.css'

export type LauncherShellState = 'default' | 'loading' | 'offline' | 'reconnecting'

export interface LauncherShellProps extends HTMLAttributes<HTMLElement> {
  title: string
  subtitle?: string
  state?: LauncherShellState
  primaryNav?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  modalLayer?: ReactNode
  toastLayer?: ReactNode
  children: ReactNode
}

export function LauncherShell({
  title,
  subtitle,
  state = 'default',
  primaryNav,
  status,
  actions,
  modalLayer,
  toastLayer,
  children,
  className,
  ...props
}: LauncherShellProps) {
  const titleId = useId()

  return (
    <section
      className={cx(styles.shell, className)}
      aria-labelledby={titleId}
      data-v2-component="launcher-shell"
      data-v2-shell="launcher"
      data-v2-state={state}
      data-state={state}
      {...props}
    >
      <div className={styles.tileGrid} aria-hidden="true" />
      <div className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.titleBand}>
            <p>Frontend V2</p>
            <h1 id={titleId}>{title}</h1>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          <div className={styles.headerAside}>
            {status ? (
              <div className={styles.statusLayer} role="status" aria-live="polite">
                {status}
              </div>
            ) : null}
            {primaryNav ? <nav aria-label="Launcher shell navigation">{primaryNav}</nav> : null}
            {actions ? <div className={styles.actions}>{actions}</div> : null}
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
      {toastLayer ? <div className={styles.toastLayer}>{toastLayer}</div> : null}
      {modalLayer ? <div className={styles.modalLayer}>{modalLayer}</div> : null}
    </section>
  )
}
