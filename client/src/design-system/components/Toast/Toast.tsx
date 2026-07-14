import type { HTMLAttributes, ReactNode } from 'react'

import { cx } from '../shared'
import styles from './Toast.module.css'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  onPress: () => void
}

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  tone?: ToastTone
  title: string
  message?: string
  icon?: ReactNode
  action?: ToastAction
  onDismiss?: () => void
}

export function Toast({
  tone = 'info',
  title,
  message,
  icon,
  action,
  onDismiss,
  className,
  ...props
}: ToastProps) {
  return (
    <div
      className={cx(styles.toast, className)}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      data-v2-component="toast"
      data-v2-state={tone}
      data-state={tone}
      {...props}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon ?? <ToastIcon tone={tone} />}
      </span>
      <div className={styles.content}>
        <strong>{title}</strong>
        {message ? <p>{message}</p> : null}
      </div>
      {action ? (
        <button className={styles.action} type="button" onClick={action.onPress}>
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <button className={styles.dismiss} type="button" aria-label="알림 닫기" onClick={onDismiss}>
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  )
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path fill="currentColor" d="m8.1 13.6-3.2-3.2 1.3-1.3 1.9 1.9 5.7-5.7 1.3 1.3-7 7Z" />
      </svg>
    )
  }

  if (tone === 'error') {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path fill="currentColor" d="M9 4h2v7H9V4Zm0 9h2v2H9v-2Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" focusable="false">
      <path fill="currentColor" d="M9 5h2v2H9V5Zm0 4h2v6H9V9Z" />
    </svg>
  )
}
