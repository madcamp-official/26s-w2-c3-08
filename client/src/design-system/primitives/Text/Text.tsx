import type { ElementType, HTMLAttributes, ReactNode } from 'react'

import { cx } from '../shared'
import styles from './Text.module.css'

export type TextVariant = 'body' | 'caption' | 'title' | 'display'
export type TextTone = 'primary' | 'secondary' | 'danger' | 'inverse'
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold'
export type TextAlign = 'start' | 'center' | 'end'

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  variant?: TextVariant
  tone?: TextTone
  weight?: TextWeight
  align?: TextAlign
  children: ReactNode
}

export function Text({
  as: Component = 'p',
  variant = 'body',
  tone = 'primary',
  weight = 'regular',
  align = 'start',
  className,
  children,
  ...props
}: TextProps) {
  return (
    <Component
      className={cx(styles.text, className)}
      data-variant={variant}
      data-tone={tone}
      data-weight={weight}
      data-align={align}
      {...props}
    >
      {children}
    </Component>
  )
}
