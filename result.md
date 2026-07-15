# Frontend V2 Main/Login Update Result

## Summary

- Super Mario reference video segment `11:20` to `13:10` was cut into a silent web background asset.
- The trimmed video was added as `client/public/media/main-background-mario-nowarp.mp4`.
- `LauncherShell` now supports an optional decorative `backgroundVideoSrc` layer.
- S2 Main uses the trimmed video as a subtle launcher background behind the main screen.
- The S2 Main avatar card and CTA stack were enlarged and centered so the main controls no longer feel small or top-biased.
- The S1 Login screen card, input, and submit button were enlarged for better presence.
- Contract/self-tests were updated to cover the new launcher video slot, main screen sizing, login sizing, and visual audit expectations.

## Implementation Notes

- No legacy `client/src/App.tsx` or `client/src/App.css` changes were made.
- No Phaser gameplay behavior was changed.
- No production dependency was added. Temporary ffmpeg tooling was used outside the repository to generate the trimmed MP4.
- The original source video remains outside the committed app asset path; only the optimized public background video is intended for the frontend.
- UI styling uses existing design tokens for colors, spacing, radius, typography, opacity, and effects.

## Main Screen Changes

- Added optional video background support to `LauncherShell`.
- Applied `/media/main-background-mario-nowarp.mp4` only to S2 Main.
- Preserved the launcher grid and blue overlay so UI text and controls stay readable.
- Expanded the main layout to fill the viewport height so the lower area is covered by video instead of empty blue space.
- Increased avatar panel, avatar preview, CTA button width/height, and text scale.
- Re-centered the avatar and CTA cluster inside the launcher shell.

## Login Screen Changes

- Changed the login shell to centered layout.
- Enlarged login panel width and padding.
- Enlarged nickname input height and font size.
- Enlarged the submit button height and font size.
- Removed the small decorative preview block from the login view.

## Validation

Commands run and results:

- `npm run main:check --workspace client` - passed.
- `npm run login:check --workspace client` - passed.
- `npm run shells:check --workspace client` - passed.
- `npm run launcher:check --workspace client` - passed.
- `npm run lint --workspace client -- --quiet` - passed.
- `npm run smoke --workspace client` - passed.
- `npm run build --workspace client` - passed with the existing large chunk warning.
- `npm run test:launcher-screenshots --workspace client` - passed, `165 passed`.
- `git diff --check` - passed.
- `npm run test --workspace client` - unavailable because `client/package.json` has no `test` script.
- `npm run e2e --workspace client` - unavailable because `client/package.json` has no `e2e` script.

## Visual Evidence

- Main state gallery route used for review:
  - `http://127.0.0.1:5173/ui-v2.html#/state-gallery?case=s2-main-avatar-generating`
- Browser screenshot matrix validated Launcher screens at:
  - `1280x720`
  - `1440x900`
  - `1920x1080`

## Remaining Risks

- The Super Mario video is third-party media. Public production use should be approved for copyright/brand risk before deployment.
- Final visual golden baseline approval remains a product/design sign-off item.
