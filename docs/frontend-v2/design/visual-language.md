# Visual Language

작성일: 2026-07-13  
범위: Frontend V2 visual language. Legacy UI의 JSX/CSS/시각 스타일을 복사하지 않는다.

## 1. Principles

- Code-first React components, UI Lab, State Gallery, and Playwright screenshots are the design source.
- Design tokens own UI colors, spacing, radii, typography, opacity, shadows, and focus effects.
- Launcher, Studio, and Game screens use separate shell patterns.
- State must be expressed by text and icon/shape, not color alone.
- Text is never embedded inside generated images.
- Phaser canvas visibility has priority in Game Shell.

## 2. Launcher Shell

대상: S1, S2, S2b, S2c, S3, C.

| Aspect | Direction |
|---|---|
| Color | `color.launcher.sky`, `color.launcher.title`, `color.action.primary`, `color.surface.panel`, `color.surface.muted` 중심 |
| Surface | bright background, title band, restrained panels, light elevation |
| Density | low to medium density; fast entry and clear CTAs |
| Layout | large primary action zone, avatar/room/status panels, clear modal layering |
| Rhythm | generous spacing, stable card grids, no crowded inspector panels |
| Imagery | product-relevant bitmap or in-app asset previews only; no decorative blobs |

Launcher should feel like a polished game launcher, not a marketing landing page.

## 3. Studio Shell

대상: A, B.

| Aspect | Direction |
|---|---|
| Color | neutral canvas surround, `color.surface.tool`, `color.surface.panel`, semantic state tokens |
| Surface | flat utilitarian panels, visible resize/collapse affordances, no nested cards |
| Density | high density; tools, palette, fields, and submit state must be scannable |
| Layout | left tools/palette, center drawing viewport, right properties or submit region |
| Canvas | checker/grid are display overlays and visually subordinate to artwork |
| Feedback | selected tool, dirty state, disabled reason, export/submission status are explicit |

Studio should optimize repeated creation work. Decoration yields to precise controls.

## 4. Game Shell

대상: S4, D, M, E, F.

| Aspect | Direction |
|---|---|
| Color | darker HUD contrast tokens and semantic status tokens over restrained surfaces |
| Surface | compact HUD bands and side panels outside critical canvas content |
| Density | medium to high; timer, budget, rank, penalties, validation state are glanceable |
| Layout | Phaser canvas first; React HUD wraps or docks without covering core play space |
| Motion | gameplay motion belongs to Phaser; React animation must not obscure timing feedback |
| Results | table/list clarity over celebration graphics |

Game Shell must make the canvas inspectable at 1280x720, 1440x900, and 1920x1080.

## 5. Forbidden Styles

- thick black pixel borders;
- stair-step 3D buttons;
- body text in pixel fonts;
- large flat primary-color surfaces without texture or hierarchy;
- sky background with small white text;
- text-only rounded tool buttons when a known icon is clearer;
- cards inside cards;
- decorative orbs, bokeh blobs, or unrelated gradient blobs;
- one-note palettes dominated by one hue family;
- legacy class names, layout patterns, or CSS copied from `App.css`;
- Figma AI/image import artifacts used as production components.

## 6. Typography Tokens

Typography token source should live in the design token source, with generated CSS consumed by components.

| Token | Purpose |
|---|---|
| `font.family.body` | Korean UI body, forms, buttons; Pretendard-family target |
| `font.family.display` | title bands, timers, large numerals; Galmuri-family target |
| `font.size.caption` | badges, helper text, meta |
| `font.size.body` | default text |
| `font.size.bodyStrong` | dense labels and table emphasis |
| `font.size.titleSm` | panel and modal titles |
| `font.size.titleMd` | screen section titles |
| `font.size.titleLg` | launcher title band and major game status |
| `font.lineHeight.tight` | badges, chips, dense HUD |
| `font.lineHeight.normal` | fields, body text |
| `font.weight.regular` | default text |
| `font.weight.medium` | labels and secondary buttons |
| `font.weight.semibold` | primary buttons and section titles |
| `font.weight.bold` | display numbers and winner emphasis |

Rules:

- do not scale font size with viewport width;
- letter spacing is `0` unless a token explicitly approves another value;
- compact panels use compact heading tokens, not hero-scale type.

## 7. Responsive Principles

Supported viewports:

- 1280x720
- 1440x900
- 1920x1080

Rules:

- fixed-format UI such as boards, canvas frames, icon buttons, tabs, and HUD counters must have stable dimensions;
- Launcher grids reflow without hiding primary CTAs;
- Studio panels may collapse or scroll, while the drawing viewport stays inspectable;
- Game HUD may wrap or dock, but it must not cover essential Phaser cells or race space;
- text must not overflow buttons, tabs, cards, rows, or modals;
- modal content must fit 720px height with internal scroll where needed.

## 8. State Expression

| State | Required expression |
|---|---|
| loading | text plus spinner/progress; preserve layout size |
| empty | empty state title, short guidance, optional action |
| success | success text, optional toast, next action |
| validation error | field-level text linked to control |
| offline | persistent banner/badge and disabled remote-only actions |
| reconnecting | realtime badge and disabled phase-changing controls |
| queued/generating | status badge, time estimate text, progress where available |
| failed | failure badge, reason if available, retry affordance if allowed |
| disabled | visible reason through helper text, tooltip, or inline status |
| selected/active | icon/shape/text state, not color alone |
| winner/local player | rank text and label, not color alone |

Semantic status names must match `component-contracts.md`.
