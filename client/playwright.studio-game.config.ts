import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  testMatch: /studio-game-screenshots\.spec\.ts/,
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/studio-game-screenshots', open: 'never' }],
  ],
  outputDir: './test-results/studio-game-screenshots',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4179',
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'off',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4179',
    url: 'http://127.0.0.1:4179/ui-v2.html#/state-gallery',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
