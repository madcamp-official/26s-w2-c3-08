import { forwardRef, useId, type InputHTMLAttributes } from 'react'

import { cx, mergeIds } from '../shared'
import styles from './TextField.module.css'

export type TextFieldState = 'idle' | 'error' | 'disabled' | 'loading'

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onSubmit' | 'size'> {
  label: string
  helper?: string
  error?: string
  loading?: boolean
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    id,
    label,
    helper,
    error,
    loading = false,
    disabled = false,
    required = false,
    className,
    onChange,
    onSubmit,
    onKeyDown,
    type = 'text',
    'aria-describedby': ariaDescribedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? `${generatedId}-field`
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
  const state: TextFieldState = disabled ? 'disabled' : error ? 'error' : loading ? 'loading' : 'idle'
  const describedBy = mergeIds(ariaDescribedBy, helper && helperId, error && errorId)

  return (
    <div
      className={cx(styles.field, className)}
      data-v2-component="text-field"
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
      <div className={styles.controlWrap} data-state={state}>
        <input
          ref={ref}
          id={inputId}
          className={styles.control}
          type={type}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          aria-busy={loading || undefined}
          onChange={(event) => onChange?.(event.currentTarget.value)}
          onKeyDown={(event) => {
            onKeyDown?.(event)

            if (!event.defaultPrevented && event.key === 'Enter' && onSubmit && !disabled) {
              onSubmit(event.currentTarget.value)
            }
          }}
          {...props}
        />
        {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      </div>
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
    </div>
  )
})
