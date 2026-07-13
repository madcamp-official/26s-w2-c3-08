# Phase 2B.1 Playwright Browser Validation

Status: STARTED - environment dependency blocked in this container
Date: 2026-07-13

Scope: browser validation harness for the Phase 2B drawing-engine spike.

## Preconditions

Completed before starting this work:
- Phase 2B files exist and are tracked.
- Phase 2B files are already committed separately in `f9d8e02`.
- `client/src/game/AGENTS.md` is committed.
- Phase 0/1 documents are committed.
- Phase 2A code and report are committed.
- baseline tests pass.
- `git status --short --untracked-files=all` was clean before Phase 2B.1 edits began.

## Dependency Decision

Added dev-only dependency:
- `@playwright/test`

Why:
- Phase 2B identified browser-only gaps: Canvas 2D PNG encoding, real canvas readback, overlay exclusion in the DOM, and screenshot/canvas-pixel validation.

Alternatives considered:
- pure Node tests: already used in Phase 2B, but cannot validate browser Canvas/PNG behavior.
- jsdom/canvas: would add a simulated canvas stack and still not prove browser encoder behavior.

Runtime impact:
- no production dependency added.
- no app runtime bundle dependency is imported by production code.

## Added Validation

Files:
- `client/playwright.drawing.config.ts`
- `client/tests/drawing-engine/browser-harness.html`
- `client/tests/drawing-engine/browser.spec.ts`

Script:
- `npm run test:drawing-browser --workspace client`

Validated in browser:
- `encodePngDataUrl` creates a decodable PNG data URL for the visible crop.
- `writeSnapshotToCanvas` preserves 768x1536 workspace pixels.
- `readCanvasPixels` reads the workspace canvas dimensions/data back.
- DOM overlay color does not affect source export pixels.
- managed canvas adapter display resize and cleanup behavior.
- preview canvas is nonblank and pixel-readable.
- Playwright screenshot buffer is generated as a smoke visual artifact.

## Validation Result In This Environment

Commands:
- `npm run test:drawing-browser --workspace client` -> BLOCKED before test body ran.

Observed blocker:
- Playwright Chromium launch failed because the host is missing `libatk-1.0.so.0`.
- `npx playwright install --with-deps chromium` could not install system dependencies because sudo requires an interactive password.
- `npx playwright install chromium` succeeded, but browser launch still requires the missing system library.

Environment checks:
- no system `chromium`, `chromium-browser`, `google-chrome`, or `google-chrome-stable` binary was found.
- `ldconfig` found `libnss3`, but not `libatk-1.0`, `libatk-bridge`, or `libgtk-3`.

Passing non-browser validation after adding the harness:
- `npm run lint --workspace client -- --quiet` -> PASS.
- `npm run smoke --workspace client` -> PASS.
- `npm run build --workspace client` -> PASS.
- `node --experimental-strip-types client/tests/v2-contracts.test.ts` -> PASS.
- `node --experimental-strip-types client/tests/drawing-engine/core.test.ts` -> PASS.
- `git diff --check` -> PASS.

Required unblock:
- install Playwright system dependencies on the host, for example through `npx playwright install --with-deps chromium` in an environment where sudo is available, or preinstall the equivalent GTK/ATK Chromium runtime libraries.

## Still Out Of Scope

- production Avatar Studio integration;
- pointer drag tool implementation;
- paste/drop blocking on the final UI surface;
- screenshot golden baseline approval;
- Design System/UI shell work;
- Phaser changes;
- Socket.IO adapter work.
