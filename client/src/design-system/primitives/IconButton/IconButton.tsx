import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cx } from '../shared'
import styles from './IconButton.module.css'

export type IconButtonSize = 'small' | 'medium' | 'large'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  icon: ReactNode
  size?: IconButtonSize
  pressed?: boolean
  disabled?: boolean
  loading?: boolean
  'aria-label': string
}

export function IconButton({
  icon,
  size = 'medium',
  pressed = false,
  disabled = false,
  loading = false,
  type = 'button',
  className,
  'aria-label': ariaLabel,
  ...props
}: IconButtonProps) {
  const isDisabled = disabled || loading
  const state = loading ? 'loading' : isDisabled ? 'disabled' : pressed ? 'pressed' : 'idle'

  return (
    <button
      className={cx(styles.iconButton, className)}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-pressed={pressed || undefined}
      aria-label={ariaLabel}
      data-size={size}
      data-state={state}
      {...props}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span className={styles.iconSlot} aria-hidden="true">
        {icon}
      </span>
    </button>
  )
}
