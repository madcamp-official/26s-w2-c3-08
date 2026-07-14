import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cx } from '../shared'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'small' | 'medium' | 'large'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  iconStart?: ReactNode
  iconEnd?: ReactNode
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  iconStart,
  iconEnd,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  const state = loading ? 'loading' : isDisabled ? 'disabled' : 'idle'

  return (
    <button
      className={cx(styles.button, fullWidth && styles.fullWidth, className)}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      data-state={state}
      {...props}
    >
      <span className={styles.content}>
        {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
        {iconStart ? (
          <span className={styles.iconSlot} aria-hidden="true">
            {iconStart}
          </span>
        ) : null}
        <span className={styles.label}>{children}</span>
        {iconEnd ? (
          <span className={styles.iconSlot} aria-hidden="true">
            {iconEnd}
          </span>
        ) : null}
      </span>
    </button>
  )
}
