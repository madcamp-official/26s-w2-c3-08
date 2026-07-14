import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/lobby-room',
  testMatch: /lobby-room-contexts\.spec\.ts/,
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/lobby-room', open: 'never' }],
  ],
  outputDir: './test-results/lobby-room',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4176',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4176',
    url: 'http://127.0.0.1:4176/ui-v2.html#/lobby',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
