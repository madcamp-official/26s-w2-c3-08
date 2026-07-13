export interface ReactSketchCanvasFeasibility {
  readonly option: 'react-sketch-canvas-adapter'
  readonly recommendedForProductionDefault: boolean
  readonly usableForLegacyCompatibility: boolean
  readonly blockingGaps: readonly string[]
  readonly retainedStrengths: readonly string[]
}

export const REACT_SKETCH_CANVAS_FEASIBILITY: ReactSketchCanvasFeasibility = {
  option: 'react-sketch-canvas-adapter',
  recommendedForProductionDefault: false,
  usableForLegacyCompatibility: true,
  blockingGaps: [
    'Pixel reads require exported browser PNG/canvas round trips instead of direct workspace ImageData access.',
    'Move and resize are path transforms, so raster-equivalent results are not deterministic enough for contract tests.',
    'Drawing undo/redo and move history are separate in the legacy implementation.',
    'The library owns stroke serialization and rasterization details, which makes exact crop/hash contracts indirect.',
  ],
  retainedStrengths: [
    'Fast legacy migration fallback for basic pen/eraser UX.',
    'Existing App.tsx paths already know how to export, load, translate, and scale CanvasPath data.',
    'No additional package is needed because the dependency already exists.',
  ],
}
