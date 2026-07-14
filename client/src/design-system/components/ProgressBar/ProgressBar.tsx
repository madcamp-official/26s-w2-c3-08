import { useId, type CSSProperties, type HTMLAttributes } from 'react'

import { cx } from '../shared'
import styles from './ProgressBar.module.css'

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  label: string
  indeterminate?: boolean
}

export function ProgressBar({
  value = 0,
  max = 100,
  label,
  indeterminate = false,
  className,
  ...props
}: ProgressBarProps) {
  const labelId = useId()
  const normalizedMax = max > 0 ? max : 100
  const boundedValue = Math.min(Math.max(value, 0), normalizedMax)
  const percent = Math.round((boundedValue / normalizedMax) * 100)
  const state = indeterminate ? 'indeterminate' : 'determinate'

  return (
    <div
      className={cx(styles.progress, className)}
      data-v2-component="progress-bar"
      data-v2-state={state}
      data-state={state}
      {...props}
    >
      <div className={styles.header}>
        <span id={labelId}>{label}</span>
        {indeterminate ? <span>진행 중</span> : <span>{percent}%</span>}
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuemax={indeterminate ? undefined : normalizedMax}
        aria-valuenow={indeterminate ? undefined : boundedValue}
      >
        <span className={styles.fill} style={{ '--progress-value': `${percent}%` } as CSSProperties} />
      </div>
    </div>
  )
}
