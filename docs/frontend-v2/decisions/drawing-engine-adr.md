# Drawing Engine ADR

Status: PROVISIONALLY_ACCEPTED technical recommendation for Phase 2C planning. Browser acceptance must pass in CI before this ADR can be marked ACCEPTED. Runtime integration is still PLANNED.

Latest browser evidence:
- 2026-07-14 local Playwright Chromium run: `npm run test:drawing-browser --workspace client` PASS.
- The Playwright web server runs Vite with `CHOKIDAR_USEPOLLING=1` so the browser harness can execute in watcher-limited environments without weakening the acceptance assertions.
- CI/pinned-environment PASS is still pending before this ADR status can move to ACCEPTED.

Related decisions:
- DECISION-V2-002: avatar visible canvas is 256x512.
- DECISION-V2-003: avatar 3x3 workspace buffer is 768x1536.
- DECISION-V2-004: checker/grid are display-only overlays and excluded from export/eyedropper source.
- DECISION-V2-015: screenshot/browser validation is a V2 completion gate.

## Context

Avatar Studio and Asset Studio need pixel-exact behavior before the V2 UI is implemented. The legacy UI currently uses `react-sketch-canvas` for drawing strokes and path history, then relies on browser canvas helpers for crop, composition, and eyedropper sampling.

The V2 contract requires:
- a 768x1536 avatar workspace with a centered 256x512 visible frame at workspace origin `(256, 512)`;
- preservation of pixels outside the visible frame while they remain inside the workspace;
- checker/grid/outside-dim overlays excluded from export and eyedropper;
- deterministic centered visible crop;
- RGB eyedropper that does not modify opacity;
- unified undo/redo for draw, erase, move, clear, and resize;
- dirty/content hash behavior that can block duplicate submits;
- browser validation for PNG/canvas integration before production rollout.

## Decision

Use a Canvas 2D + offscreen workspace buffer architecture as the V2 production drawing-engine direction.

The production implementation should keep a DOM-free pixel core that owns workspace pixels, history, crop, hash, and coordinate math. Browser Canvas 2D should be a thin adapter for display, pointer input, ImageData I/O, and PNG encoding.

`react-sketch-canvas` remains useful as legacy runtime behavior and as a compatibility reference, but it is not the V2 default engine because exact pixel access, unified history, deterministic crop/hash, and resize/move semantics depend on exported browser PNG/path transforms instead of direct source pixels.

## Option Comparison

| Criterion | A. react-sketch-canvas adapter | B. Canvas 2D + offscreen workspace buffer |
| --- | --- | --- |
| Exact pixel access | Indirect through `exportImage` and browser canvas sampling. | Direct `Uint8ClampedArray`/ImageData source. |
| 768x1536 workspace | Possible, but owned through library canvas/export behavior. | Native workspace state dimension. |
| 256x512 visible frame | Possible via post-export crop. | Native centered crop from source state. |
| Outside-visible preservation | Path moves can preserve off-frame strokes, but raster result is indirect. | Source pixels remain in workspace until clipped. |
| Move-all | Path translation, not raster state movement. | Pixel-buffer move with workspace clipping. |
| RGB eyedropper | Requires exported image/canvas round trip. | Direct read from source pixels; alpha 0 returns null. |
| Alpha | Stroke color alpha supported, but rasterization is library-owned. | Explicit RGBA write policy in core. |
| Checker/grid excluded | Works today because overlays are DOM layers. | Guaranteed because overlays are not source pixels. |
| Exact crop | Browser crop from exported PNG. | Deterministic raw ImageData crop; PNG encoding is adapter-only. |
| Deterministic raw pixels | Not guaranteed without library rasterization control. | Guaranteed by core tests. |
| PNG export | Built in through library. | Browser Canvas adapter encodes PNG; binary equality is not product contract. |
| Resize/resample | Path scaling, not raster resampling. | Explicit nearest/smoothed resample parameter. |
| Unified undo/redo | Legacy draw history and move history are separate. | Single snapshot history covers draw/erase/move/clear/resize. |
| Dirty/content hash | Requires export or path serialization. | Hash current pixel buffer and dimensions. |
| Serialization | Library path serialization, not final raster state. | Pixel snapshot or future command/delta serialization. |
| Performance | Good for simple strokes; exact operations require export round trips. | Predictable memory cost; optimize with history strategy. |
| Memory | Library-owned and opaque. | One avatar snapshot is 4,718,592 bytes (~4.5 MiB). |
| Testability | Browser-only for important pixel behavior. | Core is Node-testable; browser adapter still needs Playwright. |
| Maintainability | React/library coupling leaks into engine behavior. | Clear boundary: core -> browser adapter -> React controller. |

## Coordinate Model

Workspace:
- origin: top-left `(0, 0)`;
- avatar dimensions: 768x1536;
- pixel addressing: integer workspace pixel coordinates.

Visible frame:
- dimensions: 256x512;
- origin in workspace: `(256, 512)`;
- export coordinate origin: visible frame top-left, so workspace `(256, 512)` maps to export `(0, 0)`.

CSS display coordinate:
- pointer coordinates are measured against the displayed workspace rectangle.
- `rawX = ((clientX - rect.left) / rect.width) * workspaceWidth`.
- `rawY = ((clientY - rect.top) / rect.height) * workspaceHeight`.
- pixel addressing uses `Math.floor(raw)`.
- clamping is an explicit caller option. Pointer handlers may clamp for brush operations, while hit testing can inspect `inBounds`.

Device pixel coordinate:
- CSS display size is multiplied by `devicePixelRatio` and rounded for physical canvas sizing.
- Device-pixel backing size is display-only and must not change workspace pixel dimensions.

Export coordinate:
- export reads the centered visible frame from workspace source pixels.
- checker/grid/outside-dim overlays are not sampled or encoded.

## Core Ownership

The drawing core owns:
- workspace dimensions and source pixels;
- draw/erase/write alpha behavior;
- eyedropper sampling from source pixels;
- move-all and workspace clipping;
- centered visible crop as raw ImageData-like data;
- resize/resample operation selection;
- unified history;
- dirty/content hash baseline.

The browser Canvas adapter owns:
- Canvas 2D display and read/write I/O;
- PNG data URL encoding;
- pointer listener lifecycle;
- paste/drop blocking;
- device-pixel display resize.

React/Page Controller owns:
- selected tool, brush size, current color, current opacity UI state;
- form and attrs dirty state;
- submit blocking and duplicate content-hash checks;
- toast/CTA UX.

## Pixel Policies

Pen:
- writes RGBA values directly into the workspace buffer.
- opacity is applied to alpha as `round(color.a * opacity)` where opacity is normalized to `0..1`.

Eraser:
- writes transparent black `(0, 0, 0, 0)`.

Eyedropper:
- reads only workspace drawing pixels, not overlays.
- returns RGB only.
- transparent alpha `0` returns `null`.
- current opacity is not changed.

Move-all:
- moves every workspace pixel by integer delta.
- pixels moved outside the workspace are clipped.
- pixels moved outside the visible frame but still inside the workspace are preserved.

Export:
- raw export is deterministic ImageData-like data for the visible frame.
- PNG binary equality is not a product contract because browser encoders may differ.

Resize/resample:
- resize is explicit and parameterized as `nearest` or `smoothed`.
- Phase 2B does not automatically choose one for production artwork.
- Phase 2C should choose per workflow: pixel-art-preserving nearest vs preview-friendly smoothing.

Dirty/content hash:
- the core hashes dimensions plus source pixels.
- loading an initial source sets a clean baseline.
- undo can return to the clean baseline.
- form/attrs/source metadata dirty state remains outside the drawing core.

## History Strategy

Phase 2B implemented full-snapshot history because it is deterministic and simple to test.

Memory math for avatar workspace:
- 768 x 1536 x 4 = 4,718,592 bytes (~4.5 MiB) per full snapshot.
- 10 snapshots ~= 45 MiB.
- 20 snapshots ~= 90 MiB.
- 50 snapshots ~= 225 MiB.

Production recommendation:
- keep the Phase 2C default limit near 20 snapshots unless browser memory profiling says otherwise;
- consider hybrid command+delta history for long sessions;
- keep full-snapshot checkpoints around destructive operations such as resize and clear.

## Spike Result

Implemented Phase 2B files:
- `client/src/experiments/drawing-engine/core/*`
- `client/src/experiments/drawing-engine/canvas-adapter/browserCanvasAdapter.ts`
- `client/src/experiments/drawing-engine/react-sketch-adapter/feasibility.ts`
- `client/tests/drawing-engine/core.test.ts`

Core test coverage:
- avatar constants and memory math;
- outside-visible preservation;
- workspace clipping;
- eyedropper RGB/transparent/opacity behavior;
- overlay-excluded visible export crop;
- unified history for draw/erase/move/clear/resize;
- dirty/content hash baseline;
- coordinate transforms and rounding;
- resize nearest vs smoothed difference;
- lifecycle diagnostics with no core listeners.

## Remaining Gaps

Browser-only gaps for Phase 2C:
- Canvas 2D PNG encode/decode behavior in a real browser;
- pointer event listener lifecycle using a browser runner;
- paste/drop blocking on the final UI surface;
- visual comparison for checker/grid/outside-dim overlays;
- Playwright screenshot and canvas-pixel checks.

No package dependency was added in Phase 2B.
