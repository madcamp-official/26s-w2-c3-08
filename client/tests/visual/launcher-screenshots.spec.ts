import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import {
  launcherScreenshotMatrix,
  type StateGalleryViewport,
} from '../../src/dev/state-gallery/fixtures'

const viewportSizes: Record<StateGalleryViewport, { width: number; height: number }> = {
  '1280x720': { width: 1280, height: 720 },
  '1440x900': { width: 1440, height: 900 },
  '1920x1080': { width: 1920, height: 1080 },
}

test.describe('Launcher State Gallery evidence screenshots', () => {
  for (const screenshotCase of launcherScreenshotMatrix) {
    test(`${screenshotCase.caseId} at ${screenshotCase.viewport}`, async ({ page }, testInfo) => {
      const viewport = viewportSizes[screenshotCase.viewport]

      await page.setViewportSize(viewport)
      await page.goto(screenshotCase.url)

      const galleryCase = page.locator(`[data-v2-gallery-case="${screenshotCase.caseId}"]`)
      const launcherShell = galleryCase.locator('[data-v2-shell="launcher"]').first()

      await expect(galleryCase).toBeVisible()
      await expect(launcherShell).toBeVisible()
      await expect(galleryCase.locator('[data-v2-component="launcher-shell"]').first()).toBeVisible()
      await expect(page.locator('[role="dialog"]')).toHaveCount(
        shouldHaveDialog(screenshotCase.screenId, screenshotCase.state) ? 1 : 0,
      )

      const horizontalOverflow = await launcherShell.evaluate((shell) => {
        return shell.scrollWidth > shell.clientWidth + 1
      })

      expect(horizontalOverflow).toBe(false)

      const evidencePath = testInfo.outputPath(
        `evidence/${screenshotCase.screenId}-${screenshotCase.state}-${screenshotCase.viewport}-${screenshotCase.caseId}.png`,
      )

      await mkdir(dirname(evidencePath), { recursive: true })
      await page.screenshot({
        path: evidencePath,
        fullPage: true,
        animations: 'disabled',
      })
    })
  }
})

function shouldHaveDialog(screenId: string, state: string) {
  return (
    screenId === 'S2C_SETTINGS_MODAL' ||
    state === 'settingsOpen' ||
    state === 'passwordError' ||
    state === 'details' ||
    state === 'cooldown'
  )
}
