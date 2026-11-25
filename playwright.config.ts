import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_SALES_URL || 'http://127.0.0.1:9022'
const apiBaseURL = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:9029/api/v1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    ...devices['iPhone 14'],
    defaultBrowserType: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'zh-CN',
  },
  webServer: process.env.E2E_SALES_URL
    ? undefined
    : {
        command: 'npx uni --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
        env: {
          ...process.env,
          VITE_API_BASE_URL: apiBaseURL,
        },
      },
})
