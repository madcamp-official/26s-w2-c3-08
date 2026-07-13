import {
  AVATAR_VISIBLE_HEIGHT,
  AVATAR_VISIBLE_WIDTH,
  AVATAR_WORKSPACE_HEIGHT,
  AVATAR_WORKSPACE_SCALE,
  AVATAR_WORKSPACE_WIDTH,
} from 'shared'

import type { DrawingDimensions } from './types.ts'

export const BYTES_PER_PIXEL = 4

export const FULL_SNAPSHOT_BYTES =
  AVATAR_WORKSPACE_WIDTH * AVATAR_WORKSPACE_HEIGHT * BYTES_PER_PIXEL

export const SNAPSHOT_MEMORY_ESTIMATES = {
  one: FULL_SNAPSHOT_BYTES,
  ten: FULL_SNAPSHOT_BYTES * 10,
  twenty: FULL_SNAPSHOT_BYTES * 20,
  fifty: FULL_SNAPSHOT_BYTES * 50,
} as const

export function createDrawingDimensions(input: {
  visibleWidth: number
  visibleHeight: number
  workspaceScale?: number
}): DrawingDimensions {
  const workspaceScale = input.workspaceScale ?? AVATAR_WORKSPACE_SCALE
  const workspaceWidth = input.visibleWidth * workspaceScale
  const workspaceHeight = input.visibleHeight * workspaceScale

  return {
    visibleWidth: input.visibleWidth,
    visibleHeight: input.visibleHeight,
    workspaceScale,
    workspaceWidth,
    workspaceHeight,
    visibleOrigin: {
      x: Math.floor((workspaceWidth - input.visibleWidth) / 2),
      y: Math.floor((workspaceHeight - input.visibleHeight) / 2),
    },
  }
}

export const AVATAR_DRAWING_DIMENSIONS = createDrawingDimensions({
  visibleWidth: AVATAR_VISIBLE_WIDTH,
  visibleHeight: AVATAR_VISIBLE_HEIGHT,
  workspaceScale: AVATAR_WORKSPACE_SCALE,
})

if (
  AVATAR_DRAWING_DIMENSIONS.workspaceWidth !== AVATAR_WORKSPACE_WIDTH ||
  AVATAR_DRAWING_DIMENSIONS.workspaceHeight !== AVATAR_WORKSPACE_HEIGHT
) {
  throw new Error('Avatar drawing dimensions do not match shared V2 constants.')
}
