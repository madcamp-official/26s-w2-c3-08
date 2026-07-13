import { expect, test } from '@playwright/test'

interface HarnessResult {
  done: boolean
  passed: string[]
  failures: Array<{ name: string; message: string }>
  previewPixel: { r: number; g: number; b: number; a: number }
}

declare global {
  interface Window {
    __drawingEngineBrowserResults?: HarnessResult
  }
}

test('drawing engine browser adapter validates canvas IO and overlay exclusion', async ({ page }) => {
  await page.goto('/tests/drawing-engine/browser-harness.html')
  await page.waitForFunction(() => window.__drawingEngineBrowserResults?.done === true)

  const result = await page.evaluate(() => window.__drawingEngineBrowserResults)
  expect(result?.failures).toEqual([])
  expect(result?.passed).toEqual([
    'encodePngDataUrl produces decodable visible crop',
    'writeSnapshotToCanvas preserves workspace pixels',
    'overlay does not affect source export pixels',
    'managed canvas adapter resize and cleanup',
    'preview canvas is nonblank and pixel-readable',
  ])
  expect(result?.previewPixel).toEqual({ r: 15, g: 210, b: 90, a: 255 })

  const canvasPixel = await page.locator('#preview').evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement
    const context = element.getContext('2d', { willReadFrequently: true })

    if (context === null) {
      throw new Error('2D context unavailable')
    }

    const data = context.getImageData(4, 4, 1, 1).data

    return {
      r: data[0],
      g: data[1],
      b: data[2],
      a: data[3],
    }
  })
  expect(canvasPixel).toEqual({ r: 240, g: 24, b: 24, a: 255 })

  const screenshot = await page.screenshot()
  expect(screenshot.byteLength).toBeGreaterThan(1_000)
})
