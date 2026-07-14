# Frontend V2 Rebuild Instructions

## Mission

Build a completely new frontend UI for Multiplayer AI Relay Map Maker.

The legacy React UI and CSS are reference implementations only. They must remain runnable during migration, but they must not be visually reused in the V2 UI. They will be deleted only after the full V2 flow passes all gates and a prompt explicitly authorizes the final removal phase.

## Source-of-truth priority

Use sources in this order:

1. `docs/frontend-v2/decisions/product-decisions.md`
2. `docs/frontend-v2/contracts/*`
3. `docs/KJH/screen-design.md`
4. `docs/KJH/asset-attributes.md`
5. `docs/KJH/player-spec.md`
6. `docs/KJH/ai-pipeline.md`
7. `docs/LSJ/plan.md`
8. Existing runtime behavior and code
9. `docs/frontend-v2/FINAL_PLAN.md`

Do not silently resolve contradictions. Record them in `docs/frontend-v2/decisions/conflict-register.md`.

## Non-negotiable migration rules

- Do not redesign or incrementally restyle `client/src/App.tsx`.
- Do not extend `client/src/App.css` for V2 work.
- Do not copy legacy JSX or legacy CSS into V2 files.
- Do not delete the legacy UI until a prompt explicitly authorizes the final removal phase.
- Do not rename the legacy app to `LegacyApp.tsx` merely to reorganize it.
- Build the new app under the target V2 structure:
  - `client/src/app`
  - `client/src/pages`
  - `client/src/features`
  - `client/src/design-system`
  - `client/src/infrastructure`
  - `client/src/fixtures`
- Preserve existing Phaser gameplay behavior unless the current task explicitly authorizes a gameplay change.
- Do not change physics, collision, map rules, freeze penalties, race ranking, or overtime behavior during visual UI work.
- Respect deeper `AGENTS.md` files. In particular, `client/src/game/AGENTS.md` protects Phaser gameplay code.
- Do not add a production dependency without reporting:
  1. why it is required,
  2. alternatives considered,
  3. bundle/runtime impact.
- Never expose API paths, socket event names, localStorage keys, or transport-specific logic directly inside presentational components.

## Target dependency direction

Use this dependency direction:

Figma spec -> Design System -> Presentational View -> Page Controller / Feature Hook -> Use Case / Domain State -> Port -> Adapter -> API / Realtime / Storage / Phaser

Presentational components must receive serializable props and callbacks.

A presentational component must not directly import:

- Zustand stores
- API clients
- realtime clients
- localStorage helpers
- Phaser scenes
- environment flags

## Data-mode rules

Use explicit modes:

- `VITE_DATA_MODE=mock`
- `VITE_DATA_MODE=remote`
- `VITE_REALTIME_MODE=local`
- `VITE_REALTIME_MODE=remote`

In remote mode:

- Never silently fall back to Mock data.
- Never silently fall back to BroadcastChannel.
- Show a typed error, offline, or reconnecting state instead.

Local/Mock mode is for UI development, fixtures, demos, and tests.

## UI and styling rules

- Use design tokens for UI colors, spacing, radii, typography, opacity, and effects.
- Do not introduce raw UI hex values outside the token source.
- Do not place user-facing text inside generated images.
- Use semantic HTML.
- All icon-only buttons require accessible names.
- Modal dialogs require focus trap, Escape close, and focus restoration.
- State must not be communicated by color alone.
- Support at minimum:
  - 1280x720
  - 1440x900
  - 1920x1080
- Launcher, Studio, and Game screens must use separate shell patterns.
- Phaser canvas visibility has priority in Game Shell.

## Required working protocol

Before editing:

1. Inspect the relevant source files.
2. Summarize the current behavior.
3. List the files you intend to change.
4. State the acceptance criteria.
5. Confirm that the requested scope does not require unrelated changes.

During implementation:

- Keep each task narrow.
- Do not perform speculative refactors.
- Do not modify unrelated files.
- Add or update tests for behavior changes.
- Preserve current public behavior unless the task explicitly changes a contract.

After implementation, report:

1. Summary of changes.
2. Exact files changed.
3. Tests and commands run.
4. Results of every command.
5. Remaining risks.
6. Any decision that still needs product approval.

## Required validation

For frontend implementation work, run all commands that exist in the repository:

```bash
npm run lint --workspace client -- --quiet
npm run smoke --workspace client
npm run test --workspace client
npm run e2e --workspace client
npm run build --workspace client
git diff --check
```

If a listed command does not exist, report that it is unavailable instead of inventing a replacement.
