import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/accessibility',
  testMatch: /v2-accessibility\.spec\.ts/,
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/accessibility', open: 'never' }],
  ],
  outputDir: './test-results/accessibility',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4178',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4178',
    url: 'http://127.0.0.1:4178/ui-v2.html#/login',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
