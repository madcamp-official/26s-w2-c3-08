import { BYTES_PER_PIXEL } from './constants.ts'
import type { DrawingDimensions, DrawingImageData, Point, ResizeResampleMode, Rgb, Rgba } from './types.ts'

export function createTransparentPixels(dimensions: DrawingDimensions): Uint8ClampedArray {
  return new Uint8ClampedArray(dimensions.workspaceWidth * dimensions.workspaceHeight * BYTES_PER_PIXEL)
}

export function clonePixels(pixels: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels)
}

export function pixelOffset(point: Point, dimensions: DrawingDimensions): number {
  return (point.y * dimensions.workspaceWidth + point.x) * BYTES_PER_PIXEL
}

export function isInsideWorkspace(point: Point, dimensions: DrawingDimensions): boolean {
  return (
    point.x >= 0 &&
    point.x < dimensions.workspaceWidth &&
    point.y >= 0 &&
    point.y < dimensions.workspaceHeight
  )
}

export function getPixel(
  pixels: Uint8ClampedArray,
  point: Point,
  dimensions: DrawingDimensions,
): Rgba | null {
  if (!isInsideWorkspace(point, dimensions)) {
    return null
  }

  const offset = pixelOffset(point, dimensions)

  return {
    r: pixels[offset] ?? 0,
    g: pixels[offset + 1] ?? 0,
    b: pixels[offset + 2] ?? 0,
    a: pixels[offset + 3] ?? 0,
  }
}

export function setPixel(
  pixels: Uint8ClampedArray,
  point: Point,
  dimensions: DrawingDimensions,
  color: Rgba,
): void {
  if (!isInsideWorkspace(point, dimensions)) {
    return
  }

  const offset = pixelOffset(point, dimensions)
  pixels[offset] = clampChannel(color.r)
  pixels[offset + 1] = clampChannel(color.g)
  pixels[offset + 2] = clampChannel(color.b)
  pixels[offset + 3] = clampChannel(color.a)
}

export function sampleRgb(
  pixels: Uint8ClampedArray,
  point: Point,
  dimensions: DrawingDimensions,
): Rgb | null {
  const color = getPixel(pixels, point, dimensions)

  if (color === null || color.a === 0) {
    return null
  }

  return {
    r: color.r,
    g: color.g,
    b: color.b,
  }
}

export function cropPixels(
  pixels: Uint8ClampedArray,
  dimensions: DrawingDimensions,
  source: { x: number; y: number; width: number; height: number },
): DrawingImageData {
  const data = new Uint8ClampedArray(source.width * source.height * BYTES_PER_PIXEL)

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourcePoint = {
        x: source.x + x,
        y: source.y + y,
      }
      const targetOffset = (y * source.width + x) * BYTES_PER_PIXEL
      const color = getPixel(pixels, sourcePoint, dimensions)

      if (color !== null) {
        data[targetOffset] = color.r
        data[targetOffset + 1] = color.g
        data[targetOffset + 2] = color.b
        data[targetOffset + 3] = color.a
      }
    }
  }

  return {
    width: source.width,
    height: source.height,
    data,
  }
}

export function movePixels(
  pixels: Uint8ClampedArray,
  dimensions: DrawingDimensions,
  delta: Point,
): Uint8ClampedArray {
  const moved = createTransparentPixels(dimensions)

  for (let y = 0; y < dimensions.workspaceHeight; y += 1) {
    for (let x = 0; x < dimensions.workspaceWidth; x += 1) {
      const targetPoint = {
        x: x + delta.x,
        y: y + delta.y,
      }

      if (!isInsideWorkspace(targetPoint, dimensions)) {
        continue
      }

      const sourceOffset = (y * dimensions.workspaceWidth + x) * BYTES_PER_PIXEL
      const targetOffset = pixelOffset(targetPoint, dimensions)
      moved[targetOffset] = pixels[sourceOffset] ?? 0
      moved[targetOffset + 1] = pixels[sourceOffset + 1] ?? 0
      moved[targetOffset + 2] = pixels[sourceOffset + 2] ?? 0
      moved[targetOffset + 3] = pixels[sourceOffset + 3] ?? 0
    }
  }

  return moved
}

export function resizePixels(
  pixels: Uint8ClampedArray,
  sourceDimensions: DrawingDimensions,
  targetDimensions: DrawingDimensions,
  mode: ResizeResampleMode,
): Uint8ClampedArray {
  if (mode === 'nearest') {
    return resizePixelsNearest(pixels, sourceDimensions, targetDimensions)
  }

  return resizePixelsSmoothed(pixels, sourceDimensions, targetDimensions)
}

export function pixelsEqual(left: Uint8ClampedArray, right: Uint8ClampedArray): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

export function hashPixelState(dimensions: DrawingDimensions, pixels: Uint8ClampedArray): string {
  let hash = 0x811c9dc5
  hash = mixHash(hash, dimensions.workspaceWidth)
  hash = mixHash(hash, dimensions.workspaceHeight)

  for (const value of pixels) {
    hash ^= value
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function resizePixelsNearest(
  pixels: Uint8ClampedArray,
  sourceDimensions: DrawingDimensions,
  targetDimensions: DrawingDimensions,
): Uint8ClampedArray {
  const resized = createTransparentPixels(targetDimensions)

  for (let targetY = 0; targetY < targetDimensions.workspaceHeight; targetY += 1) {
    for (let targetX = 0; targetX < targetDimensions.workspaceWidth; targetX += 1) {
      const sourceX = Math.min(
        sourceDimensions.workspaceWidth - 1,
        Math.floor(((targetX + 0.5) * sourceDimensions.workspaceWidth) / targetDimensions.workspaceWidth),
      )
      const sourceY = Math.min(
        sourceDimensions.workspaceHeight - 1,
        Math.floor(((targetY + 0.5) * sourceDimensions.workspaceHeight) / targetDimensions.workspaceHeight),
      )
      copyPixel(
        pixels,
        resized,
        sourceDimensions,
        targetDimensions,
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
      )
    }
  }

  return resized
}

function resizePixelsSmoothed(
  pixels: Uint8ClampedArray,
  sourceDimensions: DrawingDimensions,
  targetDimensions: DrawingDimensions,
): Uint8ClampedArray {
  const resized = createTransparentPixels(targetDimensions)

  for (let targetY = 0; targetY < targetDimensions.workspaceHeight; targetY += 1) {
    for (let targetX = 0; targetX < targetDimensions.workspaceWidth; targetX += 1) {
      const sourceX =
        ((targetX + 0.5) * sourceDimensions.workspaceWidth) / targetDimensions.workspaceWidth - 0.5
      const sourceY =
        ((targetY + 0.5) * sourceDimensions.workspaceHeight) / targetDimensions.workspaceHeight - 0.5
      writeBilinearPixel(pixels, resized, sourceDimensions, targetDimensions, {
        sourceX,
        sourceY,
        targetX,
        targetY,
      })
    }
  }

  return resized
}

function copyPixel(
  sourcePixels: Uint8ClampedArray,
  targetPixels: Uint8ClampedArray,
  sourceDimensions: DrawingDimensions,
  targetDimensions: DrawingDimensions,
  sourcePoint: Point,
  targetPoint: Point,
): void {
  const sourceOffset = pixelOffset(sourcePoint, sourceDimensions)
  const targetOffset = pixelOffset(targetPoint, targetDimensions)
  targetPixels[targetOffset] = sourcePixels[sourceOffset] ?? 0
  targetPixels[targetOffset + 1] = sourcePixels[sourceOffset + 1] ?? 0
  targetPixels[targetOffset + 2] = sourcePixels[sourceOffset + 2] ?? 0
  targetPixels[targetOffset + 3] = sourcePixels[sourceOffset + 3] ?? 0
}

function writeBilinearPixel(
  sourcePixels: Uint8ClampedArray,
  targetPixels: Uint8ClampedArray,
  sourceDimensions: DrawingDimensions,
  targetDimensions: DrawingDimensions,
  input: {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
  },
): void {
  const x0 = Math.max(0, Math.floor(input.sourceX))
  const y0 = Math.max(0, Math.floor(input.sourceY))
  const x1 = Math.min(sourceDimensions.workspaceWidth - 1, x0 + 1)
  const y1 = Math.min(sourceDimensions.workspaceHeight - 1, y0 + 1)
  const tx = Math.min(1, Math.max(0, input.sourceX - x0))
  const ty = Math.min(1, Math.max(0, input.sourceY - y0))
  const topLeft = getPixel(sourcePixels, { x: x0, y: y0 }, sourceDimensions)
  const topRight = getPixel(sourcePixels, { x: x1, y: y0 }, sourceDimensions)
  const bottomLeft = getPixel(sourcePixels, { x: x0, y: y1 }, sourceDimensions)
  const bottomRight = getPixel(sourcePixels, { x: x1, y: y1 }, sourceDimensions)

  if (
    topLeft === null ||
    topRight === null ||
    bottomLeft === null ||
    bottomRight === null
  ) {
    return
  }

  setPixel(targetPixels, { x: input.targetX, y: input.targetY }, targetDimensions, {
    r: bilinear(topLeft.r, topRight.r, bottomLeft.r, bottomRight.r, tx, ty),
    g: bilinear(topLeft.g, topRight.g, bottomLeft.g, bottomRight.g, tx, ty),
    b: bilinear(topLeft.b, topRight.b, bottomLeft.b, bottomRight.b, tx, ty),
    a: bilinear(topLeft.a, topRight.a, bottomLeft.a, bottomRight.a, tx, ty),
  })
}

function bilinear(
  topLeft: number,
  topRight: number,
  bottomLeft: number,
  bottomRight: number,
  tx: number,
  ty: number,
): number {
  const top = topLeft + (topRight - topLeft) * tx
  const bottom = bottomLeft + (bottomRight - bottomLeft) * tx

  return clampChannel(top + (bottom - top) * ty)
}

function mixHash(hash: number, value: number): number {
  hash ^= value & 0xff
  hash = Math.imul(hash, 0x01000193)
  hash ^= (value >> 8) & 0xff
  hash = Math.imul(hash, 0x01000193)
  hash ^= (value >> 16) & 0xff
  hash = Math.imul(hash, 0x01000193)
  hash ^= (value >> 24) & 0xff
  return Math.imul(hash, 0x01000193)
}
