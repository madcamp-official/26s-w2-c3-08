import type { HTMLAttributes, ReactNode } from 'react'

import { cx } from '../shared'
import styles from './Badge.module.css'

export type BadgeState = 'queued' | 'generating' | 'ready' | 'failed' | 'offline' | 'reconnecting'

const badgeLabels: Record<BadgeState, string> = {
  queued: '대기',
  generating: '생성 중',
  ready: '준비됨',
  failed: '실패',
  offline: '오프라인',
  reconnecting: '재연결 중',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  state: BadgeState
  label?: string
  icon?: ReactNode
  ariaLabel?: string
}

export function Badge({ state, label, icon, ariaLabel, className, ...props }: BadgeProps) {
  const visibleLabel = label ?? badgeLabels[state]

  return (
    <span
      className={cx(styles.badge, className)}
      aria-label={ariaLabel ?? visibleLabel}
      data-v2-component="badge"
      data-v2-state={state}
      data-state={state}
      {...props}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon ?? <BadgeIcon state={state} />}
      </span>
      <span>{visibleLabel}</span>
    </span>
  )
}

function BadgeIcon({ state }: { state: BadgeState }) {
  if (state === 'ready') {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path fill="currentColor" d="m8.1 13.6-3.2-3.2 1.3-1.3 1.9 1.9 5.7-5.7 1.3 1.3-7 7Z" />
      </svg>
    )
  }

  if (state === 'failed' || state === 'offline') {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path fill="currentColor" d="M9 4h2v7H9V4Zm0 9h2v2H9v-2Z" />
      </svg>
    )
  }

  if (state === 'generating' || state === 'reconnecting') {
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path fill="currentColor" d="M10 3a7 7 0 1 0 7 7h-2a5 5 0 1 1-5-5V3Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" focusable="false">
      <path fill="currentColor" d="M5 5h10v10H5V5Z" />
    </svg>
  )
}
