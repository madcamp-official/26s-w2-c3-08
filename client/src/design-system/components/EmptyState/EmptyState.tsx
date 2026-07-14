import type { HTMLAttributes, ReactNode } from 'react'

import { Button } from '../../primitives'
import { cx } from '../shared'
import styles from './EmptyState.module.css'

export type EmptyStateKind = 'empty' | 'error'

export interface EmptyStateAction {
  label: string
  onPress: () => void
}

export interface EmptyStateProps extends HTMLAttributes<HTMLElement> {
  title: string
  message?: string
  action?: EmptyStateAction
  icon?: ReactNode
  state?: EmptyStateKind
}

export function EmptyState({
  title,
  message,
  action,
  icon,
  state = 'empty',
  className,
  ...props
}: EmptyStateProps) {
  return (
    <section
      className={cx(styles.state, className)}
      data-v2-component="empty-state"
      data-v2-state={state}
      data-state={state}
      {...props}
    >
      {icon ? <div className={styles.icon}>{icon}</div> : null}
      <div className={styles.copy}>
        <h3>{title}</h3>
        {message ? <p>{message}</p> : null}
      </div>
      {action ? (
        <Button variant={state === 'error' ? 'danger' : 'secondary'} size="small" onClick={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </section>
  )
}
