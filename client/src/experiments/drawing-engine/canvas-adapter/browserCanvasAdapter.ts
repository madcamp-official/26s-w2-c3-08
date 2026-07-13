import type { DrawingImageData, DrawingSnapshot } from '../core/index.ts'

export type CanvasFactory = () => HTMLCanvasElement

export interface ManagedCanvasAdapter {
  readonly listenerCount: () => number
  resizeDisplay(width: number, height: number): void
  destroy(): void
}

export function writeSnapshotToCanvas(snapshot: DrawingSnapshot, canvas: HTMLCanvasElement): void {
  canvas.width = snapshot.dimensions.workspaceWidth
  canvas.height = snapshot.dimensions.workspaceHeight
  const context = get2dContext(canvas)
  context.putImageData(
    new ImageData(
      copyForImageData(snapshot.pixels),
      snapshot.dimensions.workspaceWidth,
      snapshot.dimensions.workspaceHeight,
    ),
    0,
    0,
  )
}

export function encodePngDataUrl(imageData: DrawingImageData, canvasFactory: CanvasFactory): string {
  const canvas = canvasFactory()
  canvas.width = imageData.width
  canvas.height = imageData.height
  const context = get2dContext(canvas)
  context.putImageData(new ImageData(copyForImageData(imageData.data), imageData.width, imageData.height), 0, 0)

  return canvas.toDataURL('image/png')
}

export function readCanvasPixels(canvas: HTMLCanvasElement): DrawingImageData {
  const context = get2dContext(canvas)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

  return {
    width: imageData.width,
    height: imageData.height,
    data: new Uint8ClampedArray(imageData.data),
  }
}

export function createManagedCanvasAdapter(canvas: HTMLCanvasElement): ManagedCanvasAdapter {
  let destroyed = false
  const disposers: Array<() => void> = []

  function assertActive(): void {
    if (destroyed) {
      throw new Error('Canvas adapter has been destroyed.')
    }
  }

  return {
    listenerCount() {
      return disposers.length
    },
    resizeDisplay(width, height) {
      assertActive()
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    },
    destroy() {
      if (destroyed) {
        return
      }

      for (const dispose of disposers.splice(0)) {
        dispose()
      }

      destroyed = true
    },
  }
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (context === null) {
    throw new Error('2D canvas context is unavailable.')
  }

  return context
}

function copyForImageData(data: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
  const copy: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(data.length)
  copy.set(data)

  return copy
}
