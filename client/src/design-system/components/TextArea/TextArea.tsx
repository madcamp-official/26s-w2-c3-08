import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'

import { cx, mergeIds } from '../shared'
import styles from './TextArea.module.css'

export type TextAreaState = 'idle' | 'error' | 'disabled'

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string
  helper?: string
  error?: string
  onChange?: (value: string) => void
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    id,
    label,
    helper,
    error,
    disabled = false,
    required = false,
    rows = 4,
    maxLength,
    className,
    onChange,
    value,
    'aria-describedby': ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? `${generatedId}-textarea`
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
  const countId = `${inputId}-count`
  const state: TextAreaState = disabled ? 'disabled' : error ? 'error' : 'idle'
  const describedBy = mergeIds(
    ariaDescribedBy,
    helper && helperId,
    error && errorId,
    maxLength !== undefined && countId,
  )
  const valueLength = typeof value === 'string' ? value.length : 0

  return (
    <div
      className={cx(styles.field, className)}
      data-v2-component="text-area"
      data-v2-state={state}
      data-state={state}
    >
      <label className={styles.label} htmlFor={inputId}>
        <span>{label}</span>
        {required ? (
          <span className={styles.requiredMark} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        className={styles.control}
        disabled={disabled}
        required={required}
        rows={rows}
        maxLength={maxLength}
        value={value}
        aria-required={required || undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        {...props}
      />
      {helper ? (
        <p className={styles.helper} id={helperId}>
          {helper}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
      {maxLength ? (
        <p className={styles.count} id={countId}>
          {valueLength}/{maxLength}
        </p>
      ) : null}
    </div>
  )
})
