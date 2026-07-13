import assert from 'node:assert/strict'

import {
  AVATAR_DRAWING_DIMENSIONS,
  FULL_SNAPSHOT_BYTES,
  SNAPSHOT_MEMORY_ESTIMATES,
  createDrawingDimensions,
  createDrawingEngineCore,
  createTransparentPixels,
  cssPointToWorkspacePixel,
  cssSizeToDevicePixelSize,
  getPixel,
  hashPixelState,
  pixelsEqual,
  resizePixels,
  setPixel,
  visibleFrame,
  visibleToWorkspacePixel,
  workspaceToExportPixel,
  workspaceToVisiblePixel,
} from '../../src/experiments/drawing-engine/core/index.ts'
import type { DrawingDimensions, DrawingImageData, Point, Rgba } from '../../src/experiments/drawing-engine/core/index.ts'

const RED: Rgba = { r: 255, g: 0, b: 0, a: 255 }
const GREEN: Rgba = { r: 0, g: 180, b: 20, a: 255 }
const BLUE: Rgba = { r: 0, g: 0, b: 255, a: 255 }
const MAGENTA: Rgba = { r: 255, g: 0, b: 255, a: 255 }
const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 }

assert.equal(AVATAR_DRAWING_DIMENSIONS.visibleWidth, 256)
assert.equal(AVATAR_DRAWING_DIMENSIONS.visibleHeight, 512)
assert.equal(AVATAR_DRAWING_DIMENSIONS.workspaceScale, 3)
assert.equal(AVATAR_DRAWING_DIMENSIONS.workspaceWidth, 768)
assert.equal(AVATAR_DRAWING_DIMENSIONS.workspaceHeight, 1536)
assert.deepEqual(AVATAR_DRAWING_DIMENSIONS.visibleOrigin, { x: 256, y: 512 })
assert.equal(FULL_SNAPSHOT_BYTES, 768 * 1536 * 4)
assert.equal(SNAPSHOT_MEMORY_ESTIMATES.ten, FULL_SNAPSHOT_BYTES * 10)
assert.equal(SNAPSHOT_MEMORY_ESTIMATES.twenty, FULL_SNAPSHOT_BYTES * 20)
assert.equal(SNAPSHOT_MEMORY_ESTIMATES.fifty, FULL_SNAPSHOT_BYTES * 50)

{
  const engine = createDrawingEngineCore()
  const start = visibleToWorkspacePixel({ x: 10, y: 10 }, AVATAR_DRAWING_DIMENSIONS)
  engine.drawPoint({ point: start, color: RED })
  assertRgbaEqual(imagePixel(engine.exportVisibleImageData(), { x: 10, y: 10 }), RED)

  engine.moveAll({ x: -20, y: 0 })
  assertRgbaEqual(imagePixel(engine.exportVisibleImageData(), { x: 10, y: 10 }), TRANSPARENT)
  assert.deepEqual(engine.sampleRgb({ x: start.x - 20, y: start.y }), { r: 255, g: 0, b: 0 })

  engine.moveAll({ x: 20, y: 0 })
  assertRgbaEqual(imagePixel(engine.exportVisibleImageData(), { x: 10, y: 10 }), RED)
}

{
  const engine = createDrawingEngineCore()
  engine.drawPoint({ point: { x: 1, y: 1 }, color: BLUE })
  engine.moveAll({ x: -5, y: 0 })
  engine.moveAll({ x: 5, y: 0 })
  assert.equal(engine.sampleRgb({ x: 1, y: 1 }), null)
}

{
  const engine = createDrawingEngineCore()
  const samplePoint = visibleToWorkspacePixel({ x: 20, y: 20 }, AVATAR_DRAWING_DIMENSIONS)
  engine.setCurrentOpacity(0.37)
  engine.drawPoint({
    point: samplePoint,
    color: { r: 12, g: 34, b: 56, a: 128 },
    opacity: 1,
  })

  assert.deepEqual(engine.sampleRgb(samplePoint), { r: 12, g: 34, b: 56 })
  assert.equal(engine.sampleRgb({ x: samplePoint.x + 1, y: samplePoint.y + 1 }), null)
  assert.equal(engine.getCurrentOpacity(), 0.37)
}

{
  const engine = createDrawingEngineCore()
  const visiblePixel = visibleToWorkspacePixel({ x: 0, y: 0 }, AVATAR_DRAWING_DIMENSIONS)
  engine.drawPoint({ point: visiblePixel, color: GREEN })
  engine.drawPoint({ point: { x: visiblePixel.x - 1, y: visiblePixel.y }, color: MAGENTA })
  const exportImage = engine.exportVisibleImageData()

  assert.equal(exportImage.width, 256)
  assert.equal(exportImage.height, 512)
  assertRgbaEqual(imagePixel(exportImage, { x: 0, y: 0 }), GREEN)
  assert.equal(containsColor(exportImage, MAGENTA), false)
}

{
  const smallDimensions = createDrawingDimensions({
    visibleWidth: 4,
    visibleHeight: 4,
    workspaceScale: 3,
  })
  const engine = createDrawingEngineCore({ dimensions: smallDimensions, maxHistoryEntries: 20 })
  const point = visibleToWorkspacePixel({ x: 1, y: 1 }, smallDimensions)

  engine.drawPoint({ point, color: RED })
  assert.equal(engine.canUndo(), true)
  assert.equal(engine.undo(), true)
  assert.equal(engine.sampleRgb(point), null)
  assert.equal(engine.redo(), true)
  assert.deepEqual(engine.sampleRgb(point), { r: 255, g: 0, b: 0 })

  engine.erasePoint({ point })
  assert.equal(engine.sampleRgb(point), null)
  assert.equal(engine.undo(), true)
  assert.deepEqual(engine.sampleRgb(point), { r: 255, g: 0, b: 0 })
  assert.equal(engine.redo(), true)
  assert.equal(engine.sampleRgb(point), null)

  engine.drawPoint({ point, color: BLUE })
  engine.moveAll({ x: 1, y: 0 })
  assert.deepEqual(engine.sampleRgb({ x: point.x + 1, y: point.y }), { r: 0, g: 0, b: 255 })
  assert.equal(engine.undo(), true)
  assert.deepEqual(engine.sampleRgb(point), { r: 0, g: 0, b: 255 })

  engine.clear()
  assert.equal(engine.sampleRgb(point), null)
  assert.equal(engine.undo(), true)
  assert.deepEqual(engine.sampleRgb(point), { r: 0, g: 0, b: 255 })

  assert.equal(engine.resize({ visibleWidth: 6, visibleHeight: 6, mode: 'nearest' }), true)
  assert.equal(engine.getDimensions().workspaceWidth, 18)
  assert.equal(engine.undo(), true)
  assert.equal(engine.getDimensions().workspaceWidth, 12)
  assert.equal(engine.redo(), true)
  assert.equal(engine.getDimensions().workspaceWidth, 18)

  engine.undo()
  engine.drawPoint({ point: { x: 0, y: 0 }, color: GREEN })
  assert.equal(engine.canRedo(), false)
}

{
  const smallDimensions = createDrawingDimensions({
    visibleWidth: 4,
    visibleHeight: 4,
    workspaceScale: 3,
  })
  const sourcePixels = createTransparentPixels(smallDimensions)
  const loadedPoint = visibleToWorkspacePixel({ x: 0, y: 0 }, smallDimensions)
  setPixel(sourcePixels, loadedPoint, smallDimensions, GREEN)
  const loadedEngine = createDrawingEngineCore({ dimensions: smallDimensions, initialPixels: sourcePixels })

  assert.equal(loadedEngine.isDirty(), false)
  loadedEngine.drawPoint({ point: visibleToWorkspacePixel({ x: 1, y: 0 }, smallDimensions), color: RED })
  assert.equal(loadedEngine.isDirty(), true)
  loadedEngine.undo()
  assert.equal(loadedEngine.isDirty(), false)

  const firstEngine = createDrawingEngineCore({ dimensions: smallDimensions })
  const secondEngine = createDrawingEngineCore({ dimensions: smallDimensions })
  firstEngine.drawPoint({ point: loadedPoint, color: GREEN })
  secondEngine.drawPoint({ point: loadedPoint, color: GREEN })
  assert.equal(firstEngine.getSnapshot().hash, secondEngine.getSnapshot().hash)

  secondEngine.drawPoint({ point: loadedPoint, color: GREEN })
  assert.equal(firstEngine.getSnapshot().hash, secondEngine.getSnapshot().hash)
  secondEngine.markCleanBaseline()
  assert.equal(secondEngine.isDirty(), false)
}

{
  const frame = visibleFrame(AVATAR_DRAWING_DIMENSIONS)
  assert.deepEqual(frame, { x: 256, y: 512, width: 256, height: 512 })
  const workspacePoint = visibleToWorkspacePixel({ x: 12, y: 34 }, AVATAR_DRAWING_DIMENSIONS)
  assert.deepEqual(workspacePoint, { x: 268, y: 546 })
  assert.deepEqual(workspaceToVisiblePixel(workspacePoint, AVATAR_DRAWING_DIMENSIONS), { x: 12, y: 34 })
  assert.deepEqual(workspaceToExportPixel(workspacePoint, AVATAR_DRAWING_DIMENSIONS), { x: 12, y: 34 })
  assert.equal(workspaceToExportPixel({ x: 255, y: 546 }, AVATAR_DRAWING_DIMENSIONS), null)

  const center = cssPointToWorkspacePixel({
    clientX: 192,
    clientY: 384,
    displayRect: { left: 0, top: 0, width: 384, height: 768 },
    dimensions: AVATAR_DRAWING_DIMENSIONS,
  })
  assert.deepEqual(center.point, { x: 384, y: 768 })
  assert.equal(center.inBounds, true)

  const rightEdge = cssPointToWorkspacePixel({
    clientX: 384,
    clientY: 768,
    displayRect: { left: 0, top: 0, width: 384, height: 768 },
    dimensions: AVATAR_DRAWING_DIMENSIONS,
    clampToBounds: true,
  })
  assert.deepEqual(rightEdge.point, { x: 767, y: 1535 })
  assert.equal(rightEdge.inBounds, false)

  const negative = cssPointToWorkspacePixel({
    clientX: -1,
    clientY: -1,
    displayRect: { left: 0, top: 0, width: 384, height: 768 },
    dimensions: AVATAR_DRAWING_DIMENSIONS,
  })
  assert.equal(negative.inBounds, false)
  assert.deepEqual(cssSizeToDevicePixelSize({ cssWidth: 512, cssHeight: 1024, devicePixelRatio: 2 }), {
    width: 1024,
    height: 2048,
  })
}

{
  const tinyDimensions = createDrawingDimensions({
    visibleWidth: 1,
    visibleHeight: 1,
    workspaceScale: 2,
  })
  const targetDimensions = createDrawingDimensions({
    visibleWidth: 2,
    visibleHeight: 2,
    workspaceScale: 2,
  })
  const pixels = createTransparentPixels(tinyDimensions)
  setPixel(pixels, { x: 0, y: 0 }, tinyDimensions, RED)
  setPixel(pixels, { x: 1, y: 0 }, tinyDimensions, GREEN)
  setPixel(pixels, { x: 0, y: 1 }, tinyDimensions, BLUE)
  setPixel(pixels, { x: 1, y: 1 }, tinyDimensions, MAGENTA)

  const nearest = resizePixels(pixels, tinyDimensions, targetDimensions, 'nearest')
  const smoothed = resizePixels(pixels, tinyDimensions, targetDimensions, 'smoothed')
  assert.equal(pixelsEqual(nearest, smoothed), false)
  assert.notEqual(hashPixelState(targetDimensions, nearest), hashPixelState(targetDimensions, smoothed))
}

{
  for (let index = 0; index < 5; index += 1) {
    const engine = createDrawingEngineCore()
    assert.equal(engine.getLifecycleDiagnostics().listenerCount, 0)
    engine.drawPoint({
      point: visibleToWorkspacePixel({ x: index, y: index }, AVATAR_DRAWING_DIMENSIONS),
      color: RED,
    })
    assert.equal(engine.getLifecycleDiagnostics().listenerCount, 0)
    engine.destroy()
    assert.deepEqual(engine.getLifecycleDiagnostics(), {
      destroyed: true,
      listenerCount: 0,
      undoDepth: 0,
      redoDepth: 0,
    })
    assert.throws(() => engine.getSnapshot(), /destroyed/)
  }
}

function imagePixel(image: DrawingImageData, point: Point): Rgba {
  const offset = (point.y * image.width + point.x) * 4

  return {
    r: image.data[offset] ?? 0,
    g: image.data[offset + 1] ?? 0,
    b: image.data[offset + 2] ?? 0,
    a: image.data[offset + 3] ?? 0,
  }
}

function assertRgbaEqual(actual: Rgba | null, expected: Rgba): void {
  assert.deepEqual(actual, expected)
}

function containsColor(image: DrawingImageData, color: Rgba): boolean {
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (
      image.data[offset] === color.r &&
      image.data[offset + 1] === color.g &&
      image.data[offset + 2] === color.b &&
      image.data[offset + 3] === color.a
    ) {
      return true
    }
  }

  return false
}

assert.equal(getPixel(createTransparentPixels(AVATAR_DRAWING_DIMENSIONS), { x: 0, y: 0 }, AVATAR_DRAWING_DIMENSIONS)?.a, 0)
