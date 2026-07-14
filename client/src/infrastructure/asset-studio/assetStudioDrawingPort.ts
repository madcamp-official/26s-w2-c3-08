import {
  createDrawingDimensions,
  createDrawingEngineCore,
  visibleToWorkspacePixel,
  type DrawingEngineCore,
} from '../../experiments/drawing-engine/core/index.ts'
import { encodePngDataUrl } from '../../experiments/drawing-engine/canvas-adapter/browserCanvasAdapter.ts'
import type { AssetStudioSize } from '../../pages/asset-studio/AssetStudioScreen'
import {
  ASSET_STUDIO_CELL_PX,
  type AssetStudioAssetRecord,
  type AssetStudioDrawingPort,
  type AssetStudioResult,
} from '../../pages/asset-studio/assetStudioControllerCore'

const WORKSPACE_SCALE = 3

export function createAssetStudioDrawingPort(): AssetStudioDrawingPort {
  let engine = createEngine({ widthCells: 2, heightCells: 1 })

  return {
    getHash() {
      return engine.getSnapshot().hash
    },
    reset(size) {
      engine.destroy()
      engine = createEngine(size)
      return {
        ok: true,
        value: {
          hash: engine.getSnapshot().hash,
        },
      }
    },
    resizeAndResample(size, mode) {
      try {
        engine.resize({
          visibleWidth: size.widthCells * ASSET_STUDIO_CELL_PX,
          visibleHeight: size.heightCells * ASSET_STUDIO_CELL_PX,
          workspaceScale: WORKSPACE_SCALE,
          mode,
        })

        return {
          ok: true,
          value: {
            hash: engine.getSnapshot().hash,
          },
        }
      } catch {
        return createFailure('export_failure', '캔버스 크기를 바꾸지 못했어요.', true)
      }
    },
    loadAssetSource(asset) {
      try {
        engine.destroy()
        engine = createEngine({
          widthCells: asset.widthCells,
          heightCells: asset.heightCells,
        })
        seedAssetSource(engine, asset)
        engine.markCleanBaseline()

        return {
          ok: true,
          value: {
            hash: engine.getSnapshot().hash,
          },
        }
      } catch {
        return createFailure('export_failure', '에셋 원본을 불러오지 못했어요.', true)
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

function createEngine(size: AssetStudioSize) {
  return createDrawingEngineCore({
    dimensions: createDrawingDimensions({
      visibleWidth: size.widthCells * ASSET_STUDIO_CELL_PX,
      visibleHeight: size.heightCells * ASSET_STUDIO_CELL_PX,
      workspaceScale: WORKSPACE_SCALE,
    }),
  })
}

function seedAssetSource(engine: DrawingEngineCore, asset: AssetStudioAssetRecord) {
  const dimensions = engine.getDimensions()
  const point = visibleToWorkspacePixel({ x: 0, y: 0 }, dimensions)
  const seed = hashString(asset.id)

  engine.drawPoint({
    point,
    color: {
      r: 80 + (seed % 120),
      g: 90 + (seed % 110),
      b: 100 + (seed % 100),
      a: 255,
    },
    brushSize: 4,
  })
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
): AssetStudioResult<never> {
  return {
    ok: false,
    error: {
      kind,
      message,
      retryable,
    },
  }
}
