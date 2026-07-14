import { defineConfig } from '@playwright/test'

const backendUrl = 'http://127.0.0.1:3001'
const previewUrl = 'http://127.0.0.1:4177'

export default defineConfig({
  testDir: './tests/remote-v2',
  testMatch: /remote-lobby-room\.spec\.ts/,
  timeout: 60_000,
  expect: {
    timeout: 8_000,
  },
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/remote-v2', open: 'never' }],
  ],
  outputDir: './test-results/remote-v2',
  use: {
    browserName: 'chromium',
    baseURL: previewUrl,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `npm run build --prefix ../backend && PORT=3001 CORS_ORIGIN=${previewUrl} node ../backend/dist/index.js`,
      url: `${backendUrl}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `VITE_API_PROXY_TARGET=${backendUrl} VITE_DATA_MODE=remote VITE_REALTIME_MODE=remote npm run build && VITE_API_PROXY_TARGET=${backendUrl} npm run preview -- --host 127.0.0.1 --port 4177`,
      url: `${previewUrl}/ui-v2.html#/login`,
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
})
