import {
  AVATAR_DRAWING_DIMENSIONS,
  createDrawingEngineCore,
  visibleToWorkspacePixel,
  type DrawingDimensions,
  type DrawingEngineCore,
} from '../../experiments/drawing-engine/core/index.ts'
import { encodePngDataUrl } from '../../experiments/drawing-engine/canvas-adapter/browserCanvasAdapter.ts'
import {
  type AvatarStudioDrawingPort,
  type AvatarStudioResult,
} from '../../pages/avatar-studio/avatarStudioControllerCore'
import type { AvatarStudioCanvasPoint } from '../../pages/avatar-studio/AvatarStudioScreen'

export function createAvatarStudioDrawingPort(): AvatarStudioDrawingPort {
  let engine = createEngine()

  return {
    getHash() {
      return engine.getSnapshot().hash
    },
    getVisibleImageData() {
      return engine.exportVisibleImageData()
    },
    drawVisiblePoint(point, color, brushSize, opacity) {
      return engine.drawPoint({
        point: mapVisiblePoint(engine, point),
        color,
        brushSize,
        opacity,
      })
    },
    eraseVisiblePoint(point, brushSize) {
      return engine.erasePoint({
        point: mapVisiblePoint(engine, point),
        brushSize,
      })
    },
    sampleVisibleRgb(point) {
      return engine.sampleRgb(mapVisiblePoint(engine, point))
    },
    reset() {
      engine.destroy()
      engine = createEngine()

      return {
        ok: true,
        value: {
          hash: engine.getSnapshot().hash,
        },
      }
    },
    async loadAvatarSource(asset) {
      try {
        const sourceImageUrl = asset.sourceImageUrl?.trim()

        if (!sourceImageUrl) {
          return createFailure('export_failure', '저장된 아바타 원본 이미지를 찾을 수 없어요.', false)
        }

        const dimensions = engine.getDimensions()
        const visiblePixels = await readVisibleImagePixels(
          sourceImageUrl,
          dimensions.visibleWidth,
          dimensions.visibleHeight,
        )
        const initialPixels = createWorkspacePixelsFromVisible(visiblePixels, dimensions)

        engine.destroy()
        engine = createEngine(initialPixels)
        engine.markCleanBaseline()

        return {
          ok: true,
          value: {
            hash: engine.getSnapshot().hash,
          },
        }
      } catch {
        return createFailure('export_failure', '아바타 원본을 불러오지 못했어요.', true)
      }
    },
    exportPng() {
      try {
        const imageData = engine.exportVisibleImageData()
        const image = typeof document === 'undefined'
          ? createNonBrowserPngDataUrl(engine.getSnapshot().hash)
          : encodePngDataUrl(imageData, () => document.createElement('canvas'))

        return {
          ok: true,
          value: {
            image,
            hash: engine.getSnapshot().hash,
            width: imageData.width,
            height: imageData.height,
          },
        }
      } catch {
        return createFailure('export_failure', 'PNG를 만들지 못했어요.', true)
      }
    },
    undo() {
      return engine.undo()
    },
    redo() {
      return engine.redo()
    },
    clear() {
      try {
        engine.clear()

        return {
          ok: true,
          value: {
            hash: engine.getSnapshot().hash,
          },
        }
      } catch {
        return createFailure('export_failure', '캔버스를 지우지 못했어요.', true)
      }
    },
  }
}

function mapVisiblePoint(engine: DrawingEngineCore, point: AvatarStudioCanvasPoint) {
  const dimensions = engine.getDimensions()

  return visibleToWorkspacePixel(
    {
      x: clampInteger(Math.trunc(point.x), 0, dimensions.visibleWidth - 1),
      y: clampInteger(Math.trunc(point.y), 0, dimensions.visibleHeight - 1),
    },
    dimensions,
  )
}

function createEngine(initialPixels?: Uint8ClampedArray) {
  return createDrawingEngineCore({
    dimensions: AVATAR_DRAWING_DIMENSIONS,
    initialPixels,
  })
}

async function readVisibleImagePixels(
  sourceImageUrl: string,
  width: number,
  height: number,
): Promise<Uint8ClampedArray> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('Avatar source image loading requires a browser environment.')
  }

  const image = await loadImageElement(sourceImageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    throw new Error('2D canvas context is unavailable.')
  }

  context.clearRect(0, 0, width, height)
  context.imageSmoothingEnabled = false
  context.drawImage(image, 0, 0, width, height)

  return new Uint8ClampedArray(context.getImageData(0, 0, width, height).data)
}

function loadImageElement(sourceImageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    if (!sourceImageUrl.startsWith('data:')) {
      image.crossOrigin = 'anonymous'
    }

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Avatar source image failed to load.'))
    image.src = sourceImageUrl
  })
}

function createWorkspacePixelsFromVisible(
  visiblePixels: Uint8ClampedArray,
  dimensions: DrawingDimensions,
): Uint8ClampedArray {
  const workspacePixels = new Uint8ClampedArray(dimensions.workspaceWidth * dimensions.workspaceHeight * 4)
  const visibleStride = dimensions.visibleWidth * 4

  for (let y = 0; y < dimensions.visibleHeight; y += 1) {
    const sourceOffset = y * visibleStride
    const targetOffset =
      ((dimensions.visibleOrigin.y + y) * dimensions.workspaceWidth + dimensions.visibleOrigin.x) * 4

    workspacePixels.set(visiblePixels.subarray(sourceOffset, sourceOffset + visibleStride), targetOffset)
  }

  return workspacePixels
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createNonBrowserPngDataUrl(hash: string) {
  if (typeof btoa === 'function') {
    return `data:image/png;base64,${btoa(hash)}`
  }

  return `data:image/png;base64,${hash}`
}

function createFailure(
  kind: 'export_failure',
  message: string,
  retryable: boolean,
): AvatarStudioResult<never> {
  return {
    ok: false,
    error: {
      kind,
      message,
      retryable,
    },
  }
}
