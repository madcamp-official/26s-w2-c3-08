import type { HTMLAttributes } from 'react'

import { Button } from '../../primitives'
import { cx } from '../shared'
import styles from './ErrorState.module.css'

export interface ErrorStateAction {
  label: string
  onPress: () => void
}

export interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  message: string
  action?: ErrorStateAction
}

export function ErrorState({ title, message, action, className, ...props }: ErrorStateProps) {
  return (
    <div
      className={cx(styles.state, className)}
      role="alert"
      data-v2-component="error-state"
      data-v2-state="error"
      data-state="error"
      {...props}
    >
      <div className={styles.copy}>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {action ? (
        <Button variant="danger" size="small" onClick={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
