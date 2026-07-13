import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/drawing-engine',
  testMatch: /browser\.spec\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/tests/drawing-engine/browser-harness.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
