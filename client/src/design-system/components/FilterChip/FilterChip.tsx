import type { ButtonHTMLAttributes } from 'react'

import { cx } from '../shared'
import styles from './FilterChip.module.css'

export interface FilterChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> {
  label: string
  selected?: boolean
  count?: number
  disabled?: boolean
  onPress?: () => void
}

export function FilterChip({
  label,
  selected = false,
  count,
  disabled = false,
  onPress,
  className,
  type = 'button',
  'aria-label': ariaLabel,
  ...props
}: FilterChipProps) {
  const state = disabled ? 'disabled' : selected ? 'selected' : 'enabled'
  const accessibleLabel = ariaLabel ?? (count === undefined ? label : `${label}, ${count}`)

  return (
    <button
      className={cx(styles.chip, className)}
      type={type}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={accessibleLabel}
      data-v2-component="filter-chip"
      data-v2-state={state}
      data-state={state}
      onClick={() => onPress?.()}
      {...props}
    >
      <span>{label}</span>
      {count === undefined ? null : <span className={styles.count}>{count}</span>}
    </button>
  )
}
