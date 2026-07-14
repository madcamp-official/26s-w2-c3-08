import type { ElementType, HTMLAttributes, ReactNode } from 'react'

import { cx } from '../shared'
import styles from './Stack.module.css'

export type StackGap = 'none' | 'small' | 'medium' | 'large'
export type StackAlign = 'stretch' | 'start' | 'center' | 'end'

export interface StackProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  gap?: StackGap
  align?: StackAlign
  children: ReactNode
}

export function Stack({
  as: Component = 'div',
  gap = 'medium',
  align = 'stretch',
  className,
  children,
  ...props
}: StackProps) {
  return (
    <Component className={cx(styles.stack, className)} data-gap={gap} data-align={align} {...props}>
      {children}
    </Component>
  )
}
