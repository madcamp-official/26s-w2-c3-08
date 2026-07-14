import { expect, test, type Locator, type Page } from '@playwright/test'

import { stateGalleryCases, type StateGalleryShell } from '../../src/dev/state-gallery/fixtures'

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

const representativeGalleryCases: Array<{
  id: string
  shell: StateGalleryShell
  minimumFocusedControls: number
}> = [
  { id: 's1-login-default', shell: 'launcher', minimumFocusedControls: 2 },
  { id: 's2-main-avatar-ready', shell: 'launcher', minimumFocusedControls: 3 },
  { id: 's2b-warehouse-ready', shell: 'launcher', minimumFocusedControls: 5 },
  { id: 'a-avatar-studio-default', shell: 'studio', minimumFocusedControls: 8 },
  { id: 'b-asset-studio-default', shell: 'studio', minimumFocusedControls: 8 },
  { id: 's4-map-build-editing', shell: 'game', minimumFocusedControls: 4 },
  { id: 'f-results-winner', shell: 'game', minimumFocusedControls: 2 },
]

test.describe('representative State Gallery keyboard accessibility', () => {
  for (const galleryCase of representativeGalleryCases) {
    test(`${galleryCase.id} has labelled landmarks and reachable keyboard focus`, async ({ page }) => {
      expect(
        stateGalleryCases.some((candidate) => candidate.id === galleryCase.id),
        `missing State Gallery fixture ${galleryCase.id}`,
      ).toBe(true)

      await page.goto(`/ui-v2.html#/state-gallery?case=${encodeURIComponent(galleryCase.id)}`)

      const preview = page.locator(`[data-v2-gallery-case="${galleryCase.id}"]`)
      const shell = preview.locator(`[data-v2-shell="${galleryCase.shell}"]`).first()

      await expect(preview).toBeVisible()
      await expect(shell).toBeVisible()
      await expect(shell).toHaveAttribute('aria-labelledby', /.+/)
      await expect(shell.locator('main').first()).toBeVisible()

      const shellLabel = await shell.evaluate((element) => {
        const labelId = element.getAttribute('aria-labelledby')

        return labelId ? document.getElementById(labelId)?.textContent?.trim() ?? '' : ''
      })

      expect(shellLabel.length).toBeGreaterThan(0)
      expect(await findUnnamedIconOnlyButtons(preview)).toEqual([])

      const focusReport = await collectKeyboardFocusReport(page, galleryCase.id)

      expect(focusReport.focusedControls.length).toBeGreaterThanOrEqual(galleryCase.minimumFocusedControls)
      expect(focusReport.unnamedInteractiveControls).toEqual([])
      expect(focusReport.hiddenFocusTargets).toEqual([])
      expect(focusReport.canvasFocusTargets).toEqual([])
      expect(focusReport.missingFocusIndicators).toEqual([])
    })
  }
})

test.describe('full State Gallery structural accessibility', () => {
  for (const galleryCase of stateGalleryCases) {
    test(`${galleryCase.id} has named controls and valid aria references`, async ({ page }) => {
      await page.goto(`/ui-v2.html#/state-gallery?case=${encodeURIComponent(galleryCase.id)}`)

      const preview = page.locator(`[data-v2-gallery-case="${galleryCase.id}"]`)
      const shell = preview.locator(`[data-v2-shell="${galleryCase.shell}"]`).first()

      await expect(preview).toBeVisible()
      await expect(shell).toBeVisible()
      await expect(shell).toHaveAttribute('aria-labelledby', /.+/)
      await expect(shell.locator('main').first()).toBeVisible()
      await expect(await findUnnamedIconOnlyButtons(preview)).toEqual([])

      const shellLabel = await shell.evaluate((element) => {
        const labelId = element.getAttribute('aria-labelledby')

        return labelId ? document.getElementById(labelId)?.textContent?.trim() ?? '' : ''
      })

      expect(shellLabel.length).toBeGreaterThan(0)

      const report = await collectStructuralAccessibilityReport(preview)

      expect(report.unnamedInteractiveControls).toEqual([])
      expect(report.brokenAriaReferences).toEqual([])
      expect(report.dialogsMissingModal).toEqual([])
      expect(report.gameCanvasTabStops).toEqual([])
      expect(report.duplicateIds).toEqual([])
    })
  }
})

async function loginToMain(page: Page) {
  await page.goto('/ui-v2.html#/login')
  await expect(page.locator('[data-v2-component="login-screen"]')).toBeVisible()
  await page.getByRole('textbox', { name: '닉네임' }).fill('접근성검사')
  await page.getByRole('button', { name: '시작하기' }).click()
  await expect(page.locator('[data-v2-component="main-screen"]')).toBeVisible()
}

async function findUnnamedIconOnlyButtons(scope: Page | Locator) {
  return scope.locator('button').evaluateAll((buttons) =>
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

async function collectStructuralAccessibilityReport(scope: Locator) {
  return scope.evaluate((root) => {
    const readVisibleText = (element: Element) => element.textContent?.replace(/\s+/gu, ' ').trim() ?? ''
    const readReferenceTexts = (element: Element, attr: 'aria-labelledby' | 'aria-describedby') => {
      const ids = element.getAttribute(attr)?.trim().split(/\s+/u).filter(Boolean) ?? []

      return ids.map((id) => {
        const target = document.getElementById(id)

        return {
          id,
          exists: target !== null,
          text: target?.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
        }
      })
    }
    const readExplicitLabel = (element: HTMLElement) => {
      if (element.id.length === 0) {
        return ''
      }

      return (
        Array.from(document.querySelectorAll<HTMLLabelElement>('label'))
          .find((label) => label.htmlFor === element.id)
          ?.textContent?.replace(/\s+/gu, ' ')
          .trim() ?? ''
      )
    }
    const readAccessibleName = (element: HTMLElement) => {
      const labelledByTexts = readReferenceTexts(element, 'aria-labelledby')
        .filter((reference) => reference.exists)
        .map((reference) => reference.text)
        .filter(Boolean)
        .join(' ')

      return (
        element.getAttribute('aria-label')?.trim() ||
        labelledByTexts ||
        readExplicitLabel(element) ||
        element.closest('label')?.textContent?.replace(/\s+/gu, ' ').trim() ||
        readVisibleText(element)
      )
    }
    const toTarget = (element: HTMLElement) => ({
      tagName: element.tagName.toLowerCase(),
      type: element.getAttribute('type') ?? '',
      component: element.getAttribute('data-v2-component') ?? '',
      text: readVisibleText(element),
      ariaLabel: element.getAttribute('aria-label') ?? '',
      ariaLabelledBy: element.getAttribute('aria-labelledby') ?? '',
      html: element.outerHTML.slice(0, 240),
    })
    const isHidden = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)

      return (
        rect.width <= 0 ||
        rect.height <= 0 ||
        style.visibility === 'hidden' ||
        style.display === 'none' ||
        element.getAttribute('aria-hidden') === 'true'
      )
    }
    const interactiveSelector = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="tab"]',
      '[role="switch"]',
      '[role="menuitem"]',
    ].join(',')
    const focusableInsideCanvasSelector = [
      'a[href]',
      'button:not(:disabled)',
      'input:not(:disabled)',
      'select:not(:disabled)',
      'textarea:not(:disabled)',
      'canvas[tabindex]:not([tabindex="-1"])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')
    const unnamedInteractiveControls: ReturnType<typeof toTarget>[] = []
    const brokenAriaReferences: Array<{
      tagName: string
      component: string
      attr: string
      id: string
      reason: 'missing' | 'empty'
      html: string
    }> = []
    const duplicateIds: Array<{ id: string; count: number }> = []
    const dialogsMissingModal: ReturnType<typeof toTarget>[] = []
    const gameCanvasTabStops: ReturnType<typeof toTarget>[] = []

    root.querySelectorAll<HTMLElement>(interactiveSelector).forEach((element) => {
      if (isHidden(element)) {
        return
      }

      if (readAccessibleName(element).length === 0) {
        unnamedInteractiveControls.push(toTarget(element))
      }
    })

    root.querySelectorAll<HTMLElement>('[aria-labelledby], [aria-describedby]').forEach((element) => {
      ;(['aria-labelledby', 'aria-describedby'] as const).forEach((attr) => {
        readReferenceTexts(element, attr).forEach((reference) => {
          if (!reference.exists || reference.text.length === 0) {
            brokenAriaReferences.push({
              tagName: element.tagName.toLowerCase(),
              component: element.getAttribute('data-v2-component') ?? '',
              attr,
              id: reference.id,
              reason: reference.exists ? 'empty' : 'missing',
              html: element.outerHTML.slice(0, 240),
            })
          }
        })
      })
    })

    const idCounts = new Map<string, number>()

    root.querySelectorAll<HTMLElement>('[id]').forEach((element) => {
      idCounts.set(element.id, (idCounts.get(element.id) ?? 0) + 1)
    })
    idCounts.forEach((count, id) => {
      if (count > 1) {
        duplicateIds.push({ id, count })
      }
    })

    root.querySelectorAll<HTMLElement>('[role="dialog"]').forEach((dialog) => {
      if (dialog.getAttribute('aria-modal') !== 'true') {
        dialogsMissingModal.push(toTarget(dialog))
      }
    })

    root.querySelectorAll<HTMLElement>('[data-v2-component="phaser-canvas-frame"]').forEach((frame) => {
      frame.querySelectorAll<HTMLElement>(focusableInsideCanvasSelector).forEach((element) => {
        gameCanvasTabStops.push(toTarget(element))
      })
    })

    return {
      unnamedInteractiveControls,
      brokenAriaReferences,
      duplicateIds,
      dialogsMissingModal,
      gameCanvasTabStops,
    }
  })
}

async function collectKeyboardFocusReport(page: Page, caseId: string) {
  const focusedControls = new Map<string, FocusTarget>()
  const unnamedInteractiveControls: FocusTarget[] = []
  const hiddenFocusTargets: FocusTarget[] = []
  const canvasFocusTargets: FocusTarget[] = []
  const missingFocusIndicators: FocusTarget[] = []

  await page.locator('body').click({ position: { x: 4, y: 4 } })

  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press('Tab')

    const target = await page.evaluate((selectedCaseId) => {
      const preview = document.querySelector(`[data-v2-gallery-case="${selectedCaseId}"]`)
      const active = document.activeElement

      if (!(active instanceof HTMLElement) || !preview?.contains(active)) {
        return null
      }

      const rect = active.getBoundingClientRect()
      const style = getComputedStyle(active)
      const text = active.textContent?.replace(/\s+/gu, ' ').trim() ?? ''
      const ariaLabel = active.getAttribute('aria-label') ?? ''
      const ariaLabelledBy = active.getAttribute('aria-labelledby') ?? ''
      const explicitLabel = active.id
        ? Array.from(document.querySelectorAll<HTMLLabelElement>('label'))
            .find((label) => label.htmlFor === active.id)
            ?.textContent?.replace(/\s+/gu, ' ')
            .trim() ?? ''
        : ''
      const wrappingLabel =
        active.closest('label')?.textContent?.replace(/\s+/gu, ' ').trim() ?? ''
      const describedByText = ariaLabelledBy
        .split(/\s+/u)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ')
      const tagName = active.tagName.toLowerCase()

      return {
        key: [
          tagName,
          active.getAttribute('data-v2-component') ?? '',
          active.getAttribute('type') ?? '',
          ariaLabel,
          text,
        ].join('|'),
        tagName,
        type: active.getAttribute('type') ?? '',
        component: active.getAttribute('data-v2-component') ?? '',
        text,
        ariaLabel,
        ariaLabelledBy,
        accessibleName: ariaLabel || describedByText || explicitLabel || wrappingLabel || text,
        hidden:
          rect.width <= 0 ||
          rect.height <= 0 ||
          style.visibility === 'hidden' ||
          style.display === 'none' ||
          active.getAttribute('aria-hidden') === 'true',
        insideCanvasFrame: active.closest('[data-v2-component="phaser-canvas-frame"]') !== null,
        hasFocusIndicator:
          (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') ||
          style.boxShadow !== 'none',
      }
    }, caseId)

    if (target === null) {
      continue
    }

    if (!focusedControls.has(target.key)) {
      focusedControls.set(target.key, target)
    }
  }

  for (const target of focusedControls.values()) {
    if (target.hidden) {
      hiddenFocusTargets.push(target)
    }

    if (target.insideCanvasFrame) {
      canvasFocusTargets.push(target)
    }

    if (!target.hasFocusIndicator) {
      missingFocusIndicators.push(target)
    }

    if (isNameRequiredInteractive(target) && target.accessibleName.length === 0) {
      unnamedInteractiveControls.push(target)
    }
  }

  return {
    focusedControls: [...focusedControls.values()],
    unnamedInteractiveControls,
    hiddenFocusTargets,
    canvasFocusTargets,
    missingFocusIndicators,
  }
}

interface FocusTarget {
  key: string
  tagName: string
  type: string
  component: string
  text: string
  ariaLabel: string
  ariaLabelledBy: string
  accessibleName: string
  hidden: boolean
  insideCanvasFrame: boolean
  hasFocusIndicator: boolean
}

function isNameRequiredInteractive(target: FocusTarget) {
  return (
    target.tagName === 'button' ||
    target.tagName === 'a' ||
    target.tagName === 'input' ||
    target.tagName === 'select' ||
    target.tagName === 'textarea'
  )
}
