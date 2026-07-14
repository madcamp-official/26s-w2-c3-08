import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  testMatch: /launcher-screenshots\.spec\.ts/,
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/launcher-screenshots', open: 'never' }],
  ],
  outputDir: './test-results/launcher-screenshots',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4175',
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'off',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4175',
    url: 'http://127.0.0.1:4175/ui-v2.html#/state-gallery',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
