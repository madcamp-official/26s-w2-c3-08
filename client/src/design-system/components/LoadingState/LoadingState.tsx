import type { HTMLAttributes } from 'react'

import { cx } from '../shared'
import styles from './LoadingState.module.css'

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  message?: string
}

export function LoadingState({ label, message, className, ...props }: LoadingStateProps) {
  return (
    <div
      className={cx(styles.state, className)}
      role="status"
      aria-live="polite"
      data-v2-component="loading-state"
      data-v2-state="loading"
      data-state="loading"
      {...props}
    >
      <span className={styles.spinner} aria-hidden="true" />
      <div className={styles.copy}>
        <strong>{label}</strong>
        {message ? <p>{message}</p> : null}
      </div>
    </div>
  )
}
