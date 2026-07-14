import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { cx } from '../shared'
import styles from './Modal.module.css'

export type ModalSize = 'small' | 'medium' | 'large'
export type ModalCloseReason = 'escape' | 'backdrop' | 'action'
export type ModalBackdropPolicy = 'dismiss' | 'static'

export interface ModalProps {
  open: boolean
  title: string
  description?: string
  size?: ModalSize
  dismissible?: boolean
  backdropPolicy?: ModalBackdropPolicy
  initialFocusRef?: RefObject<HTMLElement | null>
  footer?: ReactNode
  children: ReactNode
  className?: string
  onClose: (reason: ModalCloseReason) => void
}

let activeModalCount = 0

export function Modal({
  open,
  title,
  description,
  size = 'medium',
  dismissible = true,
  backdropPolicy = 'dismiss',
  initialFocusRef,
  footer,
  children,
  className,
  onClose,
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    if (activeModalCount > 0) {
      throw new Error('Nested Modal is not supported')
    }

    activeModalCount += 1
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const frameId = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      const focusTarget = initialFocusRef?.current ?? (dialog ? getFocusableElements(dialog)[0] : null) ?? dialog
      focusTarget?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      document.body.style.overflow = previousOverflow
      activeModalCount = Math.max(0, activeModalCount - 1)

      if (restoreFocusRef.current?.isConnected) {
        restoreFocusRef.current.focus()
      }
    }
  }, [initialFocusRef, open])

  if (!open) {
    return null
  }

  function requestClose(reason: ModalCloseReason) {
    if (dismissible || reason === 'action') {
      onClose(reason)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      requestClose('escape')
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    const focusable = getFocusableElements(dialog)

    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const current = document.activeElement

    if (event.shiftKey && current === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && current === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      data-v2-component="modal-backdrop"
      data-v2-state="open"
      data-state="open"
      data-backdrop-policy={backdropPolicy}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && backdropPolicy === 'dismiss') {
          requestClose('backdrop')
        }
      }}
    >
      <div
        ref={dialogRef}
        className={cx(styles.dialog, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-v2-component="modal"
        data-v2-state="open"
        data-state="open"
        data-size={size}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {dismissible ? (
            <button
              className={styles.closeButton}
              type="button"
              aria-label="모달 닫기"
              onClick={() => requestClose('action')}
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}

function getFocusableElements(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not(:disabled)',
        'input:not(:disabled)',
        'select:not(:disabled)',
        'textarea:not(:disabled)',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null)
}
