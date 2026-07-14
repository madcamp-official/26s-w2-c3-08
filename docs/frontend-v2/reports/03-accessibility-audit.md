# Frontend V2 Accessibility Audit

작성일: 2026-07-14  
결론: **accessibility parity is NOT APPROVED**

## Scope

Checked against V2 contracts and current static/runtime evidence:

- semantic HTML and labels
- keyboard access
- focus-visible
- modal focus trap, Escape, restore
- status announcements
- icon-only accessible names
- non-color-only states
- canvas alternatives and HUD mirrors

No automated axe/browser audit was available in this repository at audit time.

## Evidence Found

| Evidence | Status | Notes |
|---|---|---|
| Primitive component self-test | PASS | includes Button/IconButton accessibility assertions |
| Core component self-test | PASS | includes Modal/Field/Toast/Badge static contracts |
| Login screen/controller self-test | PASS | includes input/error/keyboard contract checks |
| Warehouse screen/controller self-test | PASS | includes modal/status static checks |
| Lobby/Room controller self-test | PASS | static controller behavior only |
| Game bridge self-test | PASS | verifies textual Phaser bridge summary and status attributes |
| Browser keyboard/focus E2E | BLOCKED | Playwright Chromium cannot launch due missing `libatk-1.0.so.0` |
| Automated accessibility scanner | FAIL | no axe or equivalent script exists |
| Full-flow screen reader/manual audit | FAIL | no evidence recorded |

## Accessibility Matrix

| Area | Expected | Evidence | Verdict |
|---|---|---|---|
| Forms | labels, helpers/errors via accessible associations | TextField/TextArea and Login tests pass | PARTIAL |
| Buttons | 40px target, loading no layout shift, disabled readable, icon labels | primitive tests pass | PARTIAL |
| Modals | focus trap, Escape close, focus restore, title/description linkage | component test/static implementation exists | PARTIAL |
| Toast/status | `aria-live` or role status for async state | component/static checks exist | PARTIAL |
| State badges | icon/text/color, not color-only | component contract exists | PARTIAL |
| Keyboard flow | route-level and modal focus order | browser E2E blocked | BLOCKED |
| Phaser canvas | React HUD/status mirrors essential state; canvas has surrounding summary | bridge summary exists, but production game flow is fixture-only | PARTIAL |
| Drawing tools | tool labels, color names, paste/drop blocking, keyboard alternatives | Studio component contracts exist; production Avatar Studio missing; browser acceptance blocked | FAIL |
| Responsive a11y at 1280x720/1440x900/1920x1080 | no clipped focus targets or overlapped controls | screenshot/browser evidence blocked | BLOCKED |

## Critical Accessibility Gaps

| ID | Gap | Required before approval |
|---|---|---|
| A11Y-001 | No automated browser accessibility suite exists | Add and run axe or equivalent checks for all route/state gallery cases |
| A11Y-002 | Playwright cannot run in current environment | Install browser system dependencies and rerun keyboard/focus tests |
| A11Y-003 | Avatar Studio is placeholder | Implement tool semantics, canvas labels, color/opacity naming, paste/drop blocking |
| A11Y-004 | Game phase production flow is fixture-only | Verify Phaser bridge summaries, HUD mirrors, route leave/return, and keyboard focus during real phase changes |
| A11Y-005 | No manual screen-reader signoff | Record manual pass/fail notes for critical flows |

## Decision

Accessibility audit is **not approved**. Static component contracts are useful, but they do not replace browser and assistive-technology evidence.

