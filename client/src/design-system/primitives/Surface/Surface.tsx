import type { ElementType, HTMLAttributes, ReactNode } from 'react'

import { cx } from '../shared'
import styles from './Surface.module.css'

export type SurfaceVariant = 'panel' | 'muted' | 'canvas' | 'inverse'
export type SurfacePadding = 'none' | 'small' | 'medium' | 'large'
export type SurfaceRadius = 'none' | 'small' | 'medium' | 'large'
export type SurfaceShadow = 'none' | 'panel' | 'modal' | 'hud'

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  variant?: SurfaceVariant
  padding?: SurfacePadding
  radius?: SurfaceRadius
  shadow?: SurfaceShadow
  children: ReactNode
}

export function Surface({
  as: Component = 'div',
  variant = 'panel',
  padding = 'medium',
  radius = 'medium',
  shadow = 'none',
  className,
  children,
  ...props
}: SurfaceProps) {
  return (
    <Component
      className={cx(styles.surface, className)}
      data-variant={variant}
      data-padding={padding}
      data-radius={radius}
      data-shadow={shadow}
      {...props}
    >
      {children}
    </Component>
  )
}
