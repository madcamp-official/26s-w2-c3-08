import {
  cloneElement,
  useId,
  useState,
  type FocusEventHandler,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react'

import { cx, mergeIds } from '../shared'
import styles from './Tooltip.module.css'

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left'

interface TooltipTriggerProps {
  'aria-describedby'?: string
  onBlur?: FocusEventHandler<Element>
  onFocus?: FocusEventHandler<Element>
  onMouseEnter?: MouseEventHandler<Element>
  onMouseLeave?: MouseEventHandler<Element>
}

export interface TooltipProps {
  content: ReactNode
  placement?: TooltipPlacement
  children: ReactElement<TooltipTriggerProps>
}

export function Tooltip({ content, placement = 'top', children }: TooltipProps) {
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const describedBy = open ? mergeIds(children.props['aria-describedby'], tooltipId) : children.props['aria-describedby']

  return (
    <span
      className={styles.wrap}
      data-v2-component="tooltip"
      data-v2-state={open ? 'open' : 'closed'}
      data-state={open ? 'open' : 'closed'}
      data-placement={placement}
    >
      {cloneElement(children, {
        'aria-describedby': describedBy,
        onFocus: (event) => {
          children.props.onFocus?.(event)
          setOpen(true)
        },
        onBlur: (event) => {
          children.props.onBlur?.(event)
          setOpen(false)
        },
        onMouseEnter: (event) => {
          children.props.onMouseEnter?.(event)
          setOpen(true)
        },
        onMouseLeave: (event) => {
          children.props.onMouseLeave?.(event)
          setOpen(false)
        },
      })}
      <span id={tooltipId} className={cx(styles.tooltip, open && styles.open)} role="tooltip">
        {content}
      </span>
    </span>
  )
}
