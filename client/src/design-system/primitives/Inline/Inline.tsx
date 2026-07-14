import type { ElementType, HTMLAttributes, ReactNode } from 'react'

import { cx } from '../shared'
import styles from './Inline.module.css'

export type InlineGap = 'none' | 'small' | 'medium' | 'large'
export type InlineAlign = 'start' | 'center' | 'end' | 'baseline'
export type InlineJustify = 'start' | 'center' | 'end' | 'between'

export interface InlineProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  gap?: InlineGap
  align?: InlineAlign
  justify?: InlineJustify
  wrap?: boolean
  children: ReactNode
}

export function Inline({
  as: Component = 'div',
  gap = 'medium',
  align = 'center',
  justify = 'start',
  wrap = true,
  className,
  children,
  ...props
}: InlineProps) {
  return (
    <Component
      className={cx(styles.inline, className)}
      data-gap={gap}
      data-align={align}
      data-justify={justify}
      data-wrap={wrap ? 'wrap' : 'nowrap'}
      {...props}
    >
      {children}
    </Component>
  )
}
