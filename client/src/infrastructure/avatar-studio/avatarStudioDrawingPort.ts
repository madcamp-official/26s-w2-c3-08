import {
  AVATAR_DRAWING_DIMENSIONS,
  createDrawingEngineCore,
  visibleToWorkspacePixel,
  type DrawingEngineCore,
} from '../../experiments/drawing-engine/core/index.ts'
import { encodePngDataUrl } from '../../experiments/drawing-engine/canvas-adapter/browserCanvasAdapter.ts'
import {
  type AvatarStudioAssetRecord,
  type AvatarStudioDrawingPort,
  type AvatarStudioResult,
} from '../../pages/avatar-studio/avatarStudioControllerCore'

export function createAvatarStudioDrawingPort(): AvatarStudioDrawingPort {
  let engine = createEngine()

  return {
    getHash() {
      return engine.getSnapshot().hash
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
    loadAvatarSource(asset) {
      try {
        engine.destroy()
        engine = createEngine()
        seedAvatarSource(engine, asset)
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

function createEngine() {
  return createDrawingEngineCore({
    dimensions: AVATAR_DRAWING_DIMENSIONS,
  })
}

function seedAvatarSource(engine: DrawingEngineCore, asset: AvatarStudioAssetRecord) {
  const dimensions = engine.getDimensions()
  const seed = hashString(asset.id)

  for (const point of [
    { x: 96, y: 160 },
    { x: 128, y: 192 },
    { x: 160, y: 160 },
    { x: 128, y: 280 },
    { x: 128, y: 360 },
  ]) {
    engine.drawPoint({
      point: visibleToWorkspacePixel(point, dimensions),
      color: {
        r: 70 + (seed % 120),
        g: 80 + (seed % 100),
        b: 110 + (seed % 90),
        a: 255,
      },
      brushSize: point.y > 250 ? 8 : 6,
    })
  }
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
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
