# Visual QA Checklist

작성일: 2026-07-13  
범위: UI Lab, State Gallery, Playwright screenshot, accessibility, and gate review checklist.

## 1. Before Review

- [ ] The screen renders from `ui-v2.html`, not the legacy root.
- [ ] Presentational components use fixture props in State Gallery.
- [ ] No V2 view imports `client/src/App.tsx` or `client/src/App.css`.
- [ ] No presentational component imports store, API, realtime, storage, Phaser scene, or env flags.
- [ ] No user-facing text is embedded in images.
- [ ] No raw UI color values appear outside the token source.
- [ ] Long Korean text, long nicknames, and long asset names are covered.

## 2. Viewport Matrix

Run screenshot review at:

- [ ] 1280x720
- [ ] 1440x900
- [ ] 1920x1080

For each viewport:

- [ ] no text overlap;
- [ ] no clipped button/tab/card labels;
- [ ] no incoherent modal overflow;
- [ ] focus ring is visible;
- [ ] layout does not jump between loading and loaded states;
- [ ] primary action remains reachable.

## 3. Required Screenshot States

| Screen | States |
|---|---|
| S1 | default, validation error, loading |
| S2 | default avatar, generating avatar, failed avatar |
| S2b | empty, mixed status grid, detail modal |
| S2c | default, issued code, invalid code |
| A | blank, loaded unchanged, submitting/error |
| B | default, collapsed panels, success toast |
| S3 | empty room list, create form, password modal |
| C | host, non-host ready, realtime offline |
| S4 | normal editing, locked, build test modal |
| D | playing, cleared, failed/timeout |
| M | merging, fallback |
| E | normal, freeze, overtime |
| F | winner, unfinished players, local highlight |

## 4. Launcher Checks

- [ ] Title band is readable and not copied from legacy styling.
- [ ] Primary CTA is clear and keyboard reachable.
- [ ] Avatar panel state includes text, not color alone.
- [ ] Room cards show disabled reasons for full/running rooms.
- [ ] Settings modal traps focus, closes on ESC, and restores focus.
- [ ] Offline/reconnecting states disable remote-only actions without switching to mock/local fallback.

## 5. Studio Checks

- [ ] Canvas checker/grid do not visually overpower artwork.
- [ ] Tool buttons use icons with accessible names.
- [ ] Selected tool is not indicated by color alone.
- [ ] Panels collapse without hiding required submit/status controls.
- [ ] Resize handles do not cause layout overlap.
- [ ] Loaded unchanged state blocks submit with a visible reason.
- [ ] Paste/drop image import is blocked and communicated when attempted.
- [ ] Asset Studio success keeps canvas/form intact and shows toast plus warehouse CTA.

## 6. Game Checks

- [ ] Phaser canvas is visible at every required viewport.
- [ ] HUD does not cover critical cells or player area.
- [ ] Timer, budget, validation, freeze, overtime, rank, and result status are mirrored in DOM text.
- [ ] Game Shell changes do not alter physics, collision, map rules, freeze penalties, race ranking, or overtime behavior.
- [ ] Missing remote data shows typed error/offline/reconnecting state, not fabricated mock results.

## 7. Accessibility Checks

- [ ] Semantic landmarks exist for shell, main content, and dialogs.
- [ ] All icon-only buttons have accessible names.
- [ ] Field errors are associated with inputs.
- [ ] Tabs and segmented controls are keyboard operable.
- [ ] Modal focus trap, ESC close, and focus restoration pass.
- [ ] State is communicated with text/icon/shape, not color alone.
- [ ] Progress and timer updates are announced only at useful intervals.
- [ ] Canvas areas have textual labels and status summaries.

## 8. Screenshot Approval Flow

- [ ] State Gallery case id is stable.
- [ ] Screenshot filename includes screen, state, and viewport.
- [ ] Diff is reviewed against copy deck and component contracts.
- [ ] Baseline update is approved by the product/design reviewer.
- [ ] Any unresolved visual decision is recorded as an open decision.

Recommended baseline path remains open pending product approval from `TBD-CONTRACT-PD-005`.

## 9. Command Gates

For documentation-only changes:

- [ ] `git diff --check`

For frontend implementation waves, run every existing command from the repository gate list:

- [ ] `npm run lint --workspace client -- --quiet`
- [ ] `npm run smoke --workspace client`
- [ ] `npm run build --workspace client`
- [ ] `git diff --check`

When `test` and `e2e` scripts are added to `client/package.json`, they become required gates:

- [ ] `npm run test --workspace client`
- [ ] `npm run e2e --workspace client`

Existing current client scripts also include `test:drawing-browser`; run it for Drawing Engine/browser acceptance work.

## 10. Review Record Template

```text
Date:
Reviewer:
Entry:
Data mode:
Realtime mode:
Viewport:
Screens reviewed:
Screenshots approved:
Screenshots rejected:
Accessibility issues:
Open product decisions:
Runtime risk:
```
