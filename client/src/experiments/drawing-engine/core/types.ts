export interface DrawingDimensions {
  readonly visibleWidth: number
  readonly visibleHeight: number
  readonly workspaceScale: number
  readonly workspaceWidth: number
  readonly workspaceHeight: number
  readonly visibleOrigin: Point
}

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Rgba {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

export interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

export interface DrawingSnapshot {
  readonly dimensions: DrawingDimensions
  readonly pixels: Uint8ClampedArray
  readonly hash: string
}

export interface DrawingImageData {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

export interface DrawingLifecycleDiagnostics {
  readonly destroyed: boolean
  readonly listenerCount: number
  readonly undoDepth: number
  readonly redoDepth: number
}

export type ResizeResampleMode = 'nearest' | 'smoothed'
