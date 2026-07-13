import type { DrawingDimensions, Point, Rect } from './types.ts'

export interface CssDisplayRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface WorkspacePointerResult {
  readonly point: Point
  readonly raw: Point
  readonly inBounds: boolean
}

export function visibleFrame(dimensions: DrawingDimensions): Rect {
  return {
    x: dimensions.visibleOrigin.x,
    y: dimensions.visibleOrigin.y,
    width: dimensions.visibleWidth,
    height: dimensions.visibleHeight,
  }
}

export function isInsideRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  )
}

export function visibleToWorkspacePixel(point: Point, dimensions: DrawingDimensions): Point {
  return {
    x: point.x + dimensions.visibleOrigin.x,
    y: point.y + dimensions.visibleOrigin.y,
  }
}

export function workspaceToVisiblePixel(point: Point, dimensions: DrawingDimensions): Point | null {
  const frame = visibleFrame(dimensions)

  if (!isInsideRect(point, frame)) {
    return null
  }

  return {
    x: point.x - frame.x,
    y: point.y - frame.y,
  }
}

export function workspaceToExportPixel(point: Point, dimensions: DrawingDimensions): Point | null {
  return workspaceToVisiblePixel(point, dimensions)
}

export function cssPointToWorkspacePixel(input: {
  clientX: number
  clientY: number
  displayRect: CssDisplayRect
  dimensions: DrawingDimensions
  clampToBounds?: boolean
}): WorkspacePointerResult {
  const raw = {
    x:
      ((input.clientX - input.displayRect.left) / input.displayRect.width) *
      input.dimensions.workspaceWidth,
    y:
      ((input.clientY - input.displayRect.top) / input.displayRect.height) *
      input.dimensions.workspaceHeight,
  }
  const floored = {
    x: Math.floor(raw.x),
    y: Math.floor(raw.y),
  }
  const inBounds =
    floored.x >= 0 &&
    floored.x < input.dimensions.workspaceWidth &&
    floored.y >= 0 &&
    floored.y < input.dimensions.workspaceHeight

  if (input.clampToBounds !== true) {
    return {
      point: floored,
      raw,
      inBounds,
    }
  }

  return {
    point: {
      x: clampInteger(floored.x, 0, input.dimensions.workspaceWidth - 1),
      y: clampInteger(floored.y, 0, input.dimensions.workspaceHeight - 1),
    },
    raw,
    inBounds,
  }
}

export function cssSizeToDevicePixelSize(input: {
  cssWidth: number
  cssHeight: number
  devicePixelRatio: number
}): { width: number; height: number } {
  return {
    width: Math.round(input.cssWidth * input.devicePixelRatio),
    height: Math.round(input.cssHeight * input.devicePixelRatio),
  }
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
