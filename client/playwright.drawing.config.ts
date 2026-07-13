import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/drawing-engine',
  testMatch: /browser\.spec\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/drawing-engine-browser', open: 'never' }],
  ],
  outputDir: './test-results/drawing-engine-browser',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/tests/drawing-engine/browser-harness.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
