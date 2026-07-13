import { AVATAR_DRAWING_DIMENSIONS, createDrawingDimensions } from './constants.ts'
import { visibleFrame } from './coordinates.ts'
import {
  clampChannel,
  clonePixels,
  createTransparentPixels,
  cropPixels,
  hashPixelState,
  movePixels,
  pixelsEqual,
  resizePixels,
  sampleRgb,
  setPixel,
} from './pixels.ts'
import type {
  DrawingDimensions,
  DrawingImageData,
  DrawingLifecycleDiagnostics,
  DrawingSnapshot,
  Point,
  ResizeResampleMode,
  Rgb,
  Rgba,
} from './types.ts'

export interface DrawingEngineOptions {
  readonly dimensions?: DrawingDimensions
  readonly initialPixels?: Uint8ClampedArray
  readonly maxHistoryEntries?: number
}

export interface DrawPointCommand {
  readonly point: Point
  readonly color: Rgba
  readonly brushSize?: number
  readonly opacity?: number
}

export interface ResizeCommand {
  readonly visibleWidth: number
  readonly visibleHeight: number
  readonly workspaceScale?: number
  readonly mode: ResizeResampleMode
}

export interface DrawingEngineCore {
  getSnapshot(): DrawingSnapshot
  getDimensions(): DrawingDimensions
  getCurrentOpacity(): number
  setCurrentOpacity(opacity: number): void
  drawPoint(command: DrawPointCommand): boolean
  erasePoint(command: { point: Point; brushSize?: number }): boolean
  moveAll(delta: Point): boolean
  clear(): boolean
  resize(command: ResizeCommand): boolean
  sampleRgb(point: Point): Rgb | null
  exportVisibleImageData(): DrawingImageData
  undo(): boolean
  redo(): boolean
  canUndo(): boolean
  canRedo(): boolean
  markCleanBaseline(): void
  isDirty(): boolean
  destroy(): void
  getLifecycleDiagnostics(): DrawingLifecycleDiagnostics
}

interface EngineState {
  dimensions: DrawingDimensions
  pixels: Uint8ClampedArray
}

interface EngineSnapshot {
  readonly dimensions: DrawingDimensions
  readonly pixels: Uint8ClampedArray
}

const DEFAULT_HISTORY_LIMIT = 20

export function createDrawingEngineCore(options: DrawingEngineOptions = {}): DrawingEngineCore {
  let state = createInitialState(options)
  let baselineHash = hashPixelState(state.dimensions, state.pixels)
  let currentOpacity = 1
  let destroyed = false
  const maxHistoryEntries = options.maxHistoryEntries ?? DEFAULT_HISTORY_LIMIT
  const undoStack: EngineSnapshot[] = []
  const redoStack: EngineSnapshot[] = []

  function assertAlive(): void {
    if (destroyed) {
      throw new Error('Drawing engine has been destroyed.')
    }
  }

  function snapshotState(): EngineSnapshot {
    return {
      dimensions: state.dimensions,
      pixels: clonePixels(state.pixels),
    }
  }

  function commit(nextState: EngineState): boolean {
    assertAlive()

    if (
      state.dimensions.workspaceWidth === nextState.dimensions.workspaceWidth &&
      state.dimensions.workspaceHeight === nextState.dimensions.workspaceHeight &&
      pixelsEqual(state.pixels, nextState.pixels)
    ) {
      return false
    }

    undoStack.push(snapshotState())

    if (undoStack.length > maxHistoryEntries) {
      undoStack.shift()
    }

    redoStack.length = 0
    state = {
      dimensions: nextState.dimensions,
      pixels: clonePixels(nextState.pixels),
    }

    return true
  }

  return {
    getSnapshot() {
      assertAlive()

      return {
        dimensions: state.dimensions,
        pixels: clonePixels(state.pixels),
        hash: hashPixelState(state.dimensions, state.pixels),
      }
    },
    getDimensions() {
      assertAlive()
      return state.dimensions
    },
    getCurrentOpacity() {
      assertAlive()
      return currentOpacity
    },
    setCurrentOpacity(opacity) {
      assertAlive()
      currentOpacity = clampUnit(opacity)
    },
    drawPoint(command) {
      assertAlive()
      const nextPixels = clonePixels(state.pixels)
      const brushSize = normalizeBrushSize(command.brushSize)
      const effectiveOpacity = clampUnit(command.opacity ?? currentOpacity)
      const color = {
        r: command.color.r,
        g: command.color.g,
        b: command.color.b,
        a: clampChannel(command.color.a * effectiveOpacity),
      }
      applyBrush(nextPixels, state.dimensions, command.point, brushSize, color)

      return commit({
        dimensions: state.dimensions,
        pixels: nextPixels,
      })
    },
    erasePoint(command) {
      assertAlive()
      const nextPixels = clonePixels(state.pixels)
      const brushSize = normalizeBrushSize(command.brushSize)
      applyBrush(nextPixels, state.dimensions, command.point, brushSize, {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
      })

      return commit({
        dimensions: state.dimensions,
        pixels: nextPixels,
      })
    },
    moveAll(delta) {
      assertAlive()

      if (delta.x === 0 && delta.y === 0) {
        return false
      }

      return commit({
        dimensions: state.dimensions,
        pixels: movePixels(state.pixels, state.dimensions, {
          x: Math.trunc(delta.x),
          y: Math.trunc(delta.y),
        }),
      })
    },
    clear() {
      assertAlive()

      return commit({
        dimensions: state.dimensions,
        pixels: createTransparentPixels(state.dimensions),
      })
    },
    resize(command) {
      assertAlive()
      const nextDimensions = createDrawingDimensions({
        visibleWidth: command.visibleWidth,
        visibleHeight: command.visibleHeight,
        workspaceScale: command.workspaceScale ?? state.dimensions.workspaceScale,
      })

      if (
        nextDimensions.workspaceWidth === state.dimensions.workspaceWidth &&
        nextDimensions.workspaceHeight === state.dimensions.workspaceHeight
      ) {
        return false
      }

      return commit({
        dimensions: nextDimensions,
        pixels: resizePixels(state.pixels, state.dimensions, nextDimensions, command.mode),
      })
    },
    sampleRgb(point) {
      assertAlive()
      return sampleRgb(state.pixels, point, state.dimensions)
    },
    exportVisibleImageData() {
      assertAlive()

      return cropPixels(state.pixels, state.dimensions, visibleFrame(state.dimensions))
    },
    undo() {
      assertAlive()
      const previous = undoStack.pop()

      if (previous === undefined) {
        return false
      }

      redoStack.push(snapshotState())
      state = {
        dimensions: previous.dimensions,
        pixels: clonePixels(previous.pixels),
      }

      return true
    },
    redo() {
      assertAlive()
      const next = redoStack.pop()

      if (next === undefined) {
        return false
      }

      undoStack.push(snapshotState())
      state = {
        dimensions: next.dimensions,
        pixels: clonePixels(next.pixels),
      }

      return true
    },
    canUndo() {
      assertAlive()
      return undoStack.length > 0
    },
    canRedo() {
      assertAlive()
      return redoStack.length > 0
    },
    markCleanBaseline() {
      assertAlive()
      baselineHash = hashPixelState(state.dimensions, state.pixels)
    },
    isDirty() {
      assertAlive()
      return hashPixelState(state.dimensions, state.pixels) !== baselineHash
    },
    destroy() {
      destroyed = true
      undoStack.length = 0
      redoStack.length = 0
    },
    getLifecycleDiagnostics() {
      return {
        destroyed,
        listenerCount: 0,
        undoDepth: undoStack.length,
        redoDepth: redoStack.length,
      }
    },
  }
}

function createInitialState(options: DrawingEngineOptions): EngineState {
  const dimensions = options.dimensions ?? AVATAR_DRAWING_DIMENSIONS
  const expectedPixelCount = dimensions.workspaceWidth * dimensions.workspaceHeight * 4

  if (options.initialPixels !== undefined && options.initialPixels.length !== expectedPixelCount) {
    throw new Error('Initial pixel buffer does not match drawing dimensions.')
  }

  return {
    dimensions,
    pixels:
      options.initialPixels === undefined
        ? createTransparentPixels(dimensions)
        : clonePixels(options.initialPixels),
  }
}

function applyBrush(
  pixels: Uint8ClampedArray,
  dimensions: DrawingDimensions,
  point: Point,
  brushSize: number,
  color: Rgba,
): void {
  const radius = Math.floor(brushSize / 2)
  const startX = Math.trunc(point.x) - radius
  const startY = Math.trunc(point.y) - radius

  for (let y = 0; y < brushSize; y += 1) {
    for (let x = 0; x < brushSize; x += 1) {
      setPixel(
        pixels,
        {
          x: startX + x,
          y: startY + y,
        },
        dimensions,
        color,
      )
    }
  }
}

function normalizeBrushSize(value: number | undefined): number {
  return Math.max(1, Math.floor(value ?? 1))
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}
