# Screen Layouts

작성일: 2026-07-13  
범위: S1부터 F까지 V2 screen sections, shell choice, size targets, required states.

## 1. Size Matrix

Minimum supported viewport: 1280x720.  
Primary design viewport: 1440x900.  
Wide validation viewport: 1920x1080.

| Shell | Minimum behavior | Maximum behavior |
|---|---|---|
| Launcher | primary CTA and status panels remain visible at 1280x720 | content width caps; no over-wide cards |
| Studio | canvas remains inspectable; panels scroll/collapse | panels may widen within limits; center remains dominant |
| Game | Phaser canvas remains visible; HUD cannot cover essential play area | HUD may use side summaries and wider tables |

## 2. Layout Contracts

| Screen | Shell | Major sections | Size targets | Required states |
|---|---|---|---|---|
| S1 Login | Launcher | title band, nickname form, submit action, boot/error status | form must not clip at 1280x720; compact centered layout at 1920x1080 | boot loading, empty nickname, invalid length, submitting, server/offline error |
| S2 Main | Launcher | avatar panel, primary game CTA, asset/warehouse CTAs, generation summary, settings entry | avatar panel and CTAs visible together at 1280x720 | default avatar, avatar generating, avatar ready, avatar failed, loading assets, offline/reconnecting |
| S2b Warehouse | Launcher | tab header, component filters, summary metrics, asset grid, detail modal | grid reflows; modal fits 720px height with internal scroll | loading, empty, queued, generating, ready, failed, selected, cooldown, retry working |
| S2c Settings Modal | Launcher overlay | sound controls, nickname edit, device link issue, device code consume, footer actions | modal fits 1280x720 with internal scroll | default, volume changed, muted, nickname invalid, code issued, expired, invalid, loading, offline-disabled remote actions |
| A Avatar Studio | Studio | left tools/palette/avatar list, center drawing viewport, submit/description area | visible frame 256x512; workspace 768x1536; panels collapsible | blank, drawing, tool selected, checker mode, grid toggle, loaded unchanged, dirty, submitting, error, my avatars empty/non-empty |
| B Asset Studio | Studio | left tools/palette/load, center drawing viewport, right category/size/attributes/submit | n x m drawing viewport scales within center; side panels collapse at 1280x720 | default, panels collapsed, resizing, load mine/others, unchanged blocked, dirty, invalid name, success toast, submit failed |
| S3 Lobby | Launcher | room list, refresh/quick join, create room panel, private password modal | create panel must not hide room list at 1280x720 | loading rooms, empty rooms, public room, private room, full disabled, playing disabled, create loading, password error, quick join no room |
| C Room Lobby | Launcher | room header, phase rail, player slots, ready/start actions, realtime status | 2-4 slots stable without layout jump | host, non-host, ready, not ready, empty slot, not enough players, mock demo override, offline/reconnecting |
| S4 Map Build | Game | timer/budget HUD, asset shelf, tool dock, Phaser map editor, submit/test controls, build test modal | Phaser board logical size 24x10 cells, 32px snap; canvas visibility priority | normal editing, shelf collapsed, selected asset, overlap denied, budget denied, endpoint invalid, time vote, locked, submit pending/complete, test modal |
| D Validation | Game | timer HUD, PlaytestCanvas, validation status, waiting players, retry/proceed controls | Playtest canvas current 768x420 or proportional wrapper | no segment, playing, cleared, failed recorded, waiting, timeout, submit error, reconnecting |
| M Merging | Game/intermediate | merge progress, validated segment count, fallback notice, error/retry if allowed | compact progress layout; no canvas required | merging, validated segments present, fallback, merge error, offline/reconnecting |
| E Race | Game | timer/rank HUD, RaceCanvas, freeze/overtime status, remote player status | Race canvas current 768x420 or proportional wrapper; HUD outside critical play area | normal, freeze penalty, overtime, local finished, remote positions stale, missing merged map, finish |
| F Results | Game | winner summary, ranking rows, local highlight, leave action, stale/final status | result rows fit 2-4 players without overflow | all finished, some unfinished, winner, local player, validation penalty, waiting final result, malformed results |

## 3. Shell Selection Rules

- S1, S2, S2b, S2c, S3, C use Launcher Shell.
- A and B use Studio Shell.
- S4, D, E, F use Game Shell.
- M uses a Game intermediate shell because it belongs to the room phase flow but does not mount a Phaser canvas.

## 4. Required Section Details

### S1 Login

- Nickname field with visible label.
- Start button disabled until nickname is 1-12 characters.
- Boot/session restore status should not shift the form.

### S2 Main

- Avatar panel opens S2b avatar tab.
- Primary CTA opens S3.
- Secondary CTAs open B and S2b.
- Settings icon opens S2c overlay.

### S2b Warehouse

- Tabs: avatar and component.
- Component filters: all, platform, obstacle, monster, background.
- `item` is not shown as a user-created component filter.
- Asset detail modal owns equip, regenerate, edit/remix actions.

### S2c Settings

- Sound settings are local.
- Device link actions are remote-only when remote is available.
- Modal must trap focus, close on ESC, and restore focus.

### A Avatar Studio

- No image upload.
- Paste/drop import blocked.
- Checker/grid are display-only overlays.
- Submit success routes to S2 Main.

### B Asset Studio

- Category options are platform, obstacle, monster, background.
- Name is required.
- Non-avatar submit success stays in B and shows toast with warehouse CTA.
- `[새 에셋 만들기]` is the only reset action.

### S3 Lobby

- Running/playing rooms show elapsed time and cannot be joined.
- Private room opens password modal.
- Quick join handles no public room as a visible state.

### C Room Lobby

- Host can start when requirements are met.
- Non-host can toggle ready.
- Mock/local demo override must be labelled and must not imply remote authority.

### S4 Map Build

- Map editor remains a Phaser island.
- Board contract is 24x10 cells and 32px snap.
- Placement denials must explain overlap, budget, or endpoint reason.

### D Validation

- PlaytestCanvas owns local play.
- React owns validation record status and waiting state.
- Missing segment is an explicit error/empty state.

### M Merging

- Progress is announced.
- Fallback notice is visible when no validated segments exist in mock/local flow.
- Remote mode cannot silently local-merge after server failure.

### E Race

- Freeze, overtime, rank, and stale remote position states are text-visible.
- RaceCanvas owns local movement and collision behavior.

### F Results

- Ranking is sorted by the contract, not by visual order alone.
- Local player and winner are labelled in text.
- Leave room remains available.
