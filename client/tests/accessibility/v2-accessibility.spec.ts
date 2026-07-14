import { expect, test, type Page } from '@playwright/test'

test('settings modal traps focus, closes with Escape, and restores opener focus', async ({ page }) => {
  await loginToMain(page)

  const settingsButton = page.getByRole('button', { name: '설정 열기' })

  await expect(settingsButton).toBeVisible()
  await settingsButton.focus()
  await settingsButton.click()

  const dialog = page.getByRole('dialog', { name: '설정' })
  const closeButton = page.getByRole('button', { name: '모달 닫기' })
  const lastFocusable = page.getByRole('textbox', { name: '연동 코드 입력' })

  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog).toHaveAttribute('aria-describedby', /.+/)
  await expect(closeButton).toBeFocused()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

  await page.keyboard.press('Shift+Tab')
  await expect(lastFocusable).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(closeButton).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(settingsButton).toBeFocused()
})

test('launcher controls expose accessible names and live status regions', async ({ page }) => {
  await loginToMain(page)

  const unnamedIconButtons = await findUnnamedIconOnlyButtons(page)

  expect(unnamedIconButtons).toEqual([])

  const launcherStatus = page
    .locator('[data-v2-component="launcher-shell"] [role="status"][aria-live="polite"]')
    .filter({ hasText: '환영해요' })

  await expect(launcherStatus).toBeVisible()
  await expect(page.getByRole('button', { name: '설정 열기' })).toBeVisible()
})

test('game canvas wrapper has a named region, live lifecycle status, and no accidental tab stop', async ({ page }) => {
  await page.goto('/ui-v2.html#/state-gallery?case=s4-map-build-editing')

  const gameShell = page.locator('[data-v2-component="game-shell"]')
  const canvasRegion = page.getByLabel('게임 캔버스 영역')
  const bridge = page.locator('[data-v2-component="phaser-bridge"]').first()
  const bridgeStatus = bridge.locator('[role="status"][aria-live="polite"]').first()
  const canvasFrame = page.locator('[data-v2-component="phaser-canvas-frame"]').first()

  await expect(gameShell).toBeVisible()
  await expect(canvasRegion).toBeVisible()
  await expect(bridge).toBeVisible()
  await expect(bridge).toHaveAttribute('aria-label', 'MapEditorCanvas')
  await expect(bridgeStatus).toBeVisible()

  const tabbableInsideCanvas = await canvasFrame.evaluate((frame) => {
    const candidates = Array.from(
      frame.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button:not(:disabled)',
          'input:not(:disabled)',
          'select:not(:disabled)',
          'textarea:not(:disabled)',
          'canvas[tabindex]:not([tabindex="-1"])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(','),
      ),
    )

    return candidates.map((element) => ({
      tagName: element.tagName.toLowerCase(),
      label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
      tabIndex: element.getAttribute('tabindex'),
    }))
  })

  expect(tabbableInsideCanvas).toEqual([])

  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).not.toHaveAttribute('data-v2-component', 'phaser-canvas-frame')
})

async function loginToMain(page: Page) {
  await page.goto('/ui-v2.html#/login')
  await expect(page.locator('[data-v2-component="login-screen"]')).toBeVisible()
  await page.getByRole('textbox', { name: '닉네임' }).fill('접근성검사')
  await page.getByRole('button', { name: '시작하기' }).click()
  await expect(page.locator('[data-v2-component="main-screen"]')).toBeVisible()
}

async function findUnnamedIconOnlyButtons(page: Page) {
  return page.locator('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const hasIcon = button.querySelector('svg, [aria-hidden="true"]') !== null
        const visibleText = button.textContent?.trim() ?? ''
        const hasAccessibleName =
          Boolean(button.getAttribute('aria-label')) ||
          Boolean(button.getAttribute('aria-labelledby'))

        return hasIcon && visibleText.length === 0 && !hasAccessibleName
      })
      .map((button) => ({
        html: button.outerHTML.slice(0, 240),
        component: button.getAttribute('data-v2-component'),
      })),
  )
}
