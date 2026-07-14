# Frontend V2 Visual Audit

작성일: 2026-07-14  
결론: **visual parity is NOT APPROVED**

## Scope

감사 대상:

- Launcher: Login, Main, Warehouse, Settings, Lobby, Room
- Studio: Avatar Studio, Asset Studio
- Game: Map Build, Validation, Merging, Race, Results
- Viewports: 1280x720, 1440x900, 1920x1080

Legacy UI visuals are not treated as reusable design source.

## Evidence Found

| Evidence | Status | Notes |
|---|---|---|
| Design tokens | PASS | `tokens:check` passed |
| UI Lab viewport presets | PASS | UI Lab includes 1280x720, 1440x900, 1920x1080 controls |
| State Gallery | PARTIAL | Launcher/Studio/Game fixture registration exists, including Game fixtures |
| Launcher screenshot spec | PARTIAL | Spec exists and covers 1280x720, 1440x900, 1920x1080 |
| Launcher screenshot execution | BLOCKED | Config now builds and serves production preview; browser launch is blocked by missing `libatk-1.0.so.0` |
| Lobby/Room browser E2E visual behavior | BLOCKED | Chromium cannot launch due missing `libatk-1.0.so.0` |
| Drawing browser visual/pixel checks | BLOCKED | Chromium cannot launch due missing `libatk-1.0.so.0` |
| Studio screenshots | FAIL | No full Studio screenshot matrix was run |
| Game screenshots | FAIL | No S4/D/M/E/F screenshot matrix was run |

## Shell Visual Audit

| Shell | Expected | Evidence | Verdict |
|---|---|---|---|
| Launcher | sky gradient, 24-32px tile grid, yellow title band, low density, no 720p clipping | component/static checks and launcher audit self-test pass; screenshot execution reaches production preview but browser launch is blocked | PARTIAL |
| Studio | top bar, panels, center workspace, collapse/resize states, dense tool UI | Studio component self-test passes; `shells:check` fails; no screenshot execution | FAIL |
| Game | Phaser canvas priority, HUD/panels outside critical canvas, Phaser not vectorized | Game bridge static self-test passes; only fixture preview is wired; no screenshot execution | FAIL |

## Screen Visual Audit

| Screen | Visual state coverage | Viewport proof | Verdict |
|---|---|---|---|
| S1 Login | fixtures and state gallery exist | launcher screenshot run blocked | PARTIAL |
| S2 Main | fixtures and state gallery exist | launcher screenshot run blocked | PARTIAL |
| S2b Warehouse | fixtures and state gallery exist | launcher screenshot run blocked | PARTIAL |
| S2c Settings | modal states exist through main fixtures | launcher screenshot run blocked | PARTIAL |
| A Avatar Studio | placeholder route only | none | FAIL |
| B Asset Studio | fixture/controller exists | no browser screenshot proof | PARTIAL |
| S3 Lobby | screen/controller exists | lobby-room Playwright blocked | PARTIAL |
| C Room | screen/controller exists | lobby-room Playwright blocked | PARTIAL |
| S4 Map Build | fixture screen with Phaser bridge | no Game screenshot proof | FAIL |
| D Validation | fixture screen with Phaser bridge | no Game screenshot proof | FAIL |
| M Merging | fixture screen only | no Game screenshot proof | FAIL |
| E Race | fixture screen with Phaser bridge | no Game screenshot proof | FAIL |
| F Results | fixture screen only | no Game screenshot proof | FAIL |

## Visual Blockers

1. Playwright browser environment must be repaired before visual approval.
2. Launcher screenshot spec now avoids the local dev watcher by running build + preview; rerun it after installing Chromium system dependencies in the pinned environment.
3. Studio and Game shell screenshot matrices are missing.
4. Avatar Studio must stop being a placeholder before any visual parity claim.
5. S4/D/M/E/F must be connected to production state, not only fixtures, before final screenshots are meaningful.
6. `shells:check` must either accept the intended CSS variable panel widths or the CSS must return to the documented contract.

## Decision

Visual audit is **not approved**. No legacy visual removal may proceed.
