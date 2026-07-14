import { expect, test, type Locator } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import {
  stateGalleryCases,
  stateGalleryViewports,
  type StateGalleryViewport,
} from '../../src/dev/state-gallery/fixtures'

const viewportSizes: Record<StateGalleryViewport, { width: number; height: number }> = {
  '1280x720': { width: 1280, height: 720 },
  '1440x900': { width: 1440, height: 900 },
  '1920x1080': { width: 1920, height: 1080 },
}

const studioGameScreenshotMatrix = stateGalleryCases
  .filter((galleryCase) => galleryCase.shell === 'studio' || galleryCase.shell === 'game')
  .flatMap((galleryCase) =>
    stateGalleryViewports.map((viewport) => ({
      id: `${galleryCase.id}-${viewport}`,
      caseId: galleryCase.id,
      screenId: galleryCase.screenId,
      state: galleryCase.state,
      shell: galleryCase.shell,
      viewport,
      url: `/ui-v2.html#/state-gallery?case=${encodeURIComponent(galleryCase.id)}`,
    })),
  )

test.describe('Studio and Game State Gallery evidence screenshots', () => {
  for (const screenshotCase of studioGameScreenshotMatrix) {
    test(`${screenshotCase.caseId} at ${screenshotCase.viewport}`, async ({ page }, testInfo) => {
      const viewport = viewportSizes[screenshotCase.viewport]

      await page.setViewportSize(viewport)
      await page.goto(screenshotCase.url)

      const galleryCase = page.locator(`[data-v2-gallery-case="${screenshotCase.caseId}"]`)
      const shell = galleryCase.locator(`[data-v2-shell="${screenshotCase.shell}"]`).first()

      await expect(galleryCase).toBeVisible()
      await expect(shell).toBeVisible()
      await expect(
        galleryCase.locator(`[data-v2-component="${screenshotCase.shell}-shell"]`).first(),
      ).toBeVisible()

      if (screenshotCase.shell === 'game') {
        await expect(galleryCase.locator('[data-v2-screen]').first()).toBeVisible()
        await assertOptionalPhaserBridgeVisible(galleryCase)
      }

      await assertDialogsAreAccessible(galleryCase)

      const horizontalOverflow = await shell.evaluate((shellElement) => {
        return shellElement.scrollWidth > shellElement.clientWidth + 1
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

async function assertOptionalPhaserBridgeVisible(galleryCase: Locator) {
  const bridges = galleryCase.locator('[data-v2-component="phaser-bridge"]')
  const bridgeCount = await bridges.count()

  if (bridgeCount > 0) {
    await expect(bridges.first()).toBeVisible()
  }
}

async function assertDialogsAreAccessible(galleryCase: Locator) {
  const dialogs = galleryCase.locator('[role="dialog"]')
  const dialogCount = await dialogs.count()

  for (let index = 0; index < dialogCount; index += 1) {
    const dialog = dialogs.nth(index)

    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
  }
}
