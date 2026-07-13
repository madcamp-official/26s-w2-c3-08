# Phase 2B Drawing Engine Architecture Spike

Date: 2026-07-13

Role: Frontend V2 Phase 2B Drawing Engine Architecture Spike

Scope: architecture spike only. No production Studio integration, no legacy UI edits, no Store migration, no Socket.IO adapter, no Phaser changes, no Figma work, and no package/lockfile changes.

## Sources Read

- `AGENTS.md`
- `docs/frontend-v2/decisions/product-decisions.md`
- `docs/frontend-v2/contracts/screen-state-matrix.md`
- `docs/frontend-v2/contracts/migration-gates.md`
- `docs/frontend-v2/reports/01-five-decision-implementation-audit.md`
- `docs/frontend-v2/reports/02-phase-2a-shared-contract-foundation.md`
- `shared/constants.ts`
- `client/package.json`
- `client/src/App.tsx`
- `client/src/components/AvatarCreator.tsx`
- current client test and TypeScript configuration

## Legacy Analysis

Current implementation location:
- `client/src/App.tsx` owns the active legacy `SketchBoard`.
- `AvatarStudio` passes 256x512 visible dimensions into `SketchBoard`.
- `AssetStudio` passes n x m visible dimensions into the same board.
- `client/src/components/AvatarCreator.tsx` is a separate 400x400 legacy component and does not represent the V2 contract.

`react-sketch-canvas` dependent behavior:
- stroke and erase mode;
- `undo`, `redo`, `clearCanvas`;
- `exportImage`;
- `exportPaths`, `loadPaths`, `resetCanvas`;
- path translation for move-all;
- path scaling for resize.

Direct Canvas/ImageData behavior:
- `sampleImageColor`;
- `sampleSketchExportColor`;
- `cropImageRegion`;
- `composeSketchImage`;
- `loadImageElement`;
- `drawImageContained`.

Current export/crop/eyedropper behavior:
- legacy exports a full 3x workspace image, then crops the centered visible frame;
- checker/grid are DOM overlays and are not included in canvas export;
- eyedropper samples the exported workspace drawing image, or a reference+drawing composition when a reference image is active inside the visible frame;
- alpha 0 samples return null;
- eyedropper changes RGB color but does not change opacity.

Migration gaps:
- move history and draw history are not unified;
- exact pixel state is not owned by a pure engine;
- resize is path scaling, not explicit raster resampling;
- dirty/content hash for duplicate submit blocking is not a source-pixel primitive;
- important behavior still requires browser PNG/export round trips.

## Option Comparison

| Criterion | react-sketch-canvas adapter | Canvas 2D + offscreen workspace buffer |
| --- | --- | --- |
| Exact pixel access | Browser export/canvas round trip. | Direct source pixels. |
| 768x1536 workspace | Possible but library-owned. | Native dimensions. |
| 256x512 visible frame | Post-export crop. | Native crop. |
| Outside visible preservation | Path state may preserve it, but raster proof is indirect. | Pixels persist inside workspace. |
| Move-all | Path transform. | Pixel transform with clipping. |
| RGB eyedropper | Export image sample. | Direct source sample. |
| Alpha | Library rasterization. | Explicit RGBA write. |
| Overlay exclusion | Works through DOM layering. | Guaranteed by source separation. |
| Exact crop | Browser crop from PNG image. | Deterministic raw crop. |
| Deterministic raw pixel result | Not guaranteed. | Guaranteed/tested. |
| PNG export | Built-in. | Browser adapter responsibility. |
| Resize/resample | Path scale. | Explicit nearest/smoothed modes. |
| Unified undo/redo | No, legacy has split history. | Yes, snapshot history. |
| Dirty/content hash | Derived indirectly. | Source-pixel hash. |
| Serialization | Path serialization. | Pixel snapshot now; command/delta possible later. |
| Performance | Good simple UX, costly exact exports. | Predictable memory and CPU profile. |
| Memory | Opaque. | Known: ~4.5 MiB per avatar snapshot. |
| Testability | Browser-heavy. | Core Node-testable. |
| Maintainability | React/library-coupled. | Port/adapter-friendly. |

## ADR Decision

ADR file: `docs/frontend-v2/decisions/drawing-engine-adr.md`

Decision: use Canvas 2D + offscreen workspace buffer as the V2 production drawing-engine direction.

`react-sketch-canvas` is retained only as a legacy compatibility reference. It is not the V2 default because key V2 requirements depend on direct pixel ownership and deterministic core behavior.

## Implemented Spike

Core:
- `client/src/experiments/drawing-engine/core/constants.ts`
- `client/src/experiments/drawing-engine/core/coordinates.ts`
- `client/src/experiments/drawing-engine/core/engine.ts`
- `client/src/experiments/drawing-engine/core/pixels.ts`
- `client/src/experiments/drawing-engine/core/types.ts`
- `client/src/experiments/drawing-engine/core/index.ts`

Adapters:
- `client/src/experiments/drawing-engine/canvas-adapter/browserCanvasAdapter.ts`
- `client/src/experiments/drawing-engine/react-sketch-adapter/feasibility.ts`

Harness note:
- `client/src/experiments/drawing-engine/harness/README.md`

Tests:
- `client/tests/drawing-engine/core.test.ts`

## Coordinate Model

Workspace:
- origin: top-left;
- avatar size: 768x1536;
- visible frame origin: `(256, 512)`;
- visible frame size: 256x512.

CSS pointer mapping:
- convert from displayed workspace rectangle to raw workspace coordinate;
- floor raw coordinate for pixel addressing;
- clamping is explicit and does not hide `inBounds` state.

Export mapping:
- workspace `(256, 512)` maps to export `(0, 0)`;
- export reads only source pixels in the visible frame.

Device pixel mapping:
- display backing size can use `devicePixelRatio`;
- source workspace dimensions do not change because of display scale.

## Requirement Results

| Requirement | Result | Evidence |
| --- | --- | --- |
| Workspace constants/lifecycle | PASS | Core constants and lifecycle diagnostics test. |
| Pen/eraser/RGBA/opacity/clip | PASS | Draw/erase tests and clipped brush writes. |
| Eyedropper source excludes overlays | PASS for core | Core samples only source pixels. Browser overlay check remains Phase 2C. |
| Eyedropper RGB and opacity unchanged | PASS | Core test keeps opacity after sample. |
| Move-all preserves outside visible | PASS | Pixel moved outside visible and back remains intact. |
| Move-all clips outside workspace | PASS | Pixel moved beyond workspace is lost. |
| Overlays separate | PASS for architecture | Core has no overlay state; export/search excludes non-source colors. |
| Centered visible crop | PASS | Export ImageData dimensions and visible-origin pixel tested. |
| PNG export | PARTIAL | Browser Canvas adapter exists; real browser encode validation remains. |
| Resize/resample parameterized | PASS | nearest and smoothed modes implemented and compared. |
| Unified undo/redo | PASS | draw/erase/move/clear/resize covered. |
| Dirty/content hash | PASS | clean baseline, undo clean, same-pixels same-hash tested. |
| Paste/drop blocking | NOT IMPLEMENTED | UI/browser adapter responsibility, Phase 2C. |
| Lifecycle listener leaks | PASS for core | Core owns no listeners. Browser listener validation remains. |

## Memory And History

Avatar workspace memory:
- 768 x 1536 x 4 = 4,718,592 bytes (~4.5 MiB) per snapshot.
- 10 snapshots ~= 45 MiB.
- 20 snapshots ~= 90 MiB.
- 50 snapshots ~= 225 MiB.

Spike strategy:
- full-snapshot history with a default cap of 20;
- simple and deterministic for Phase 2B tests.

Production recommendation:
- keep a bounded snapshot cap for Phase 2C;
- consider hybrid command/delta history after browser profiling;
- preserve full snapshots for destructive operations such as resize and clear.

## Resize/Resample

Implemented modes:
- `nearest`: pixel-art-preserving source selection;
- `smoothed`: bilinear sampling.

No automatic production choice was made. Phase 2C should decide per workflow and preview/export expectations.

## Test Tools

Current client package status:
- no client Vitest/Jest test script;
- no Playwright script;
- no jsdom/canvas dependency;
- no new dependency added.

Pure tests use:
- Node 22;
- `node --experimental-strip-types`;
- `node:assert/strict`.

Browser-only gap:
- real Canvas 2D PNG encoding;
- actual pointer/listener lifecycle;
- paste/drop events;
- screenshot and canvas-pixel validation.

Suggested Phase 2C devDependency options, not installed in Phase 2B:
- Playwright for browser canvas, pointer, screenshot, and pixel checks;
- Vitest browser mode only if the team wants unit-style browser tests.

## Validation Snapshot

Completed during spike:
- `node --experimental-strip-types client/tests/drawing-engine/core.test.ts` -> PASS.
- `node --experimental-strip-types client/tests/v2-contracts.test.ts` -> PASS (`v2 contract self-test passed`).
- `npm run lint --workspace client -- --quiet` -> PASS.
- `npm run smoke --workspace client` -> PASS (`Frontend smoke checks passed (16/16)`).
- `npm run build --workspace client` -> PASS. Vite reported existing large chunk warnings only.
- `git diff --check` -> PASS.

Changed-scope note:
- Phase 2B files are limited to `client/src/experiments/drawing-engine/**`, `client/tests/drawing-engine/**`, `docs/frontend-v2/decisions/drawing-engine-adr.md`, and `docs/frontend-v2/reports/02b-drawing-engine-spike.md`.
- The worktree also contains pre-existing Phase 2A/shared/document files that were not modified by this spike.

## Phase 2C Recommendation

Proceed with a Canvas 2D/offscreen workspace implementation behind the V2 Page Controller / Feature Hook boundary.

Recommended next steps:
- build a browser harness or Playwright fixture before production Studio integration;
- connect pointer tools through a Page Controller, not presentational components;
- keep checker/grid/outside-dim as overlay render layers;
- expose export as raw crop plus browser PNG adapter;
- add duplicate-submit blocking through engine content hash plus form/attrs dirty state;
- do not migrate legacy `SketchBoard` until V2 parity gates pass.
