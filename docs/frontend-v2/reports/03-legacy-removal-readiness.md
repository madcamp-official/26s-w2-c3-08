# Frontend V2 Legacy Removal Readiness

작성일: 2026-07-14  
결론: **legacy removal NOT APPROVED**

## Rule

Legacy React UI and CSS must remain runnable until every critical V2 parity item is PASS. This audit found critical FAIL/BLOCKED items.

Do not delete:

- `client/src/App.tsx`
- `client/src/App.css`
- legacy runtime store/API/realtime paths needed by the current app
- `client/src/game/MapEditorCanvas.tsx`
- `client/src/game/PlaytestCanvas.tsx`
- `client/src/game/RaceCanvas.tsx`
- gameplay physics/collision/ranking/freeze/overtime behavior

## Gate Readiness

| Gate | Required | Current evidence | Verdict |
|---|---|---|---|
| Build/lint baseline | lint, smoke, build, diff check pass | PASS, except Vite chunk warning | PASS |
| Component contract baseline | primitives/core/studio/launcher pass | `shells:check` fails | FAIL |
| Launcher parity | login/main/warehouse/settings/lobby/room production flow and visual evidence | several controllers pass; `main:check` fails; Playwright blocked | FAIL |
| Studio parity | Avatar Studio and Asset Studio production drawing flows | Asset Studio partial; Avatar Studio placeholder; Drawing browser blocked | FAIL |
| Game parity | S4/D/M/E/F production phase controllers with Phaser bridge lifecycle | bridge fixture preview only | FAIL |
| mock/local mode | all flows work without backend | partial controller evidence | PARTIAL |
| remote/remote mode | remote REST + Socket.IO without fallback | no end-to-end proof; Socket.IO client dependency absent by default | FAIL |
| Visual QA | screenshot/evidence across 1280x720, 1440x900, 1920x1080 | screenshot execution blocked; Studio/Game matrices missing | FAIL |
| Accessibility QA | browser keyboard/focus/a11y checks | static checks only; browser blocked | FAIL |
| Legacy deletion safety | all critical gates PASS | critical FAIL/BLOCKED items remain | FAIL |

## Blocking Decisions

| ID | Decision needed | Owner |
|---|---|---|
| READINESS-001 | Approve adding `socket.io-client` or provide a production Socket.IO factory injection plan | Engineering/Product |
| READINESS-002 | Decide CI/browser image requirements for Playwright, including `libatk-1.0.so.0` and watcher limits | Engineering |
| READINESS-003 | Decide whether `shells:check` should accept CSS-variable panel widths as the new StudioShell contract | Design/Engineering |
| READINESS-004 | Mark Drawing Engine ADR ACCEPTED only after browser acceptance passes | Engineering |
| READINESS-005 | Approve final Avatar Studio implementation scope before deleting legacy avatar/drawing UI | Product/Engineering |

## Required Remediation Before Re-Audit

1. Implement Avatar Studio production view/controller/adapter.
2. Replace Game fixture controller with production S4/D/M/E/F controllers connected through Room/Game/Map ports.
3. Make `shells:check` and `main:check` pass.
4. Run Playwright in a pinned browser environment and produce visual evidence screenshots.
5. Add full Studio and Game screenshot matrices.
6. Add automated accessibility checks and manual critical-flow signoff.
7. Prove `VITE_DATA_MODE=remote` and `VITE_REALTIME_MODE=remote` with no mock/local fallback.
8. Re-run the complete validation matrix.

## Final Decision

Legacy removal is **not approved** on 2026-07-14.

The V2 work should continue under the migration rule: legacy remains runnable while V2 parity gaps are closed.

