import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_PATH = process.env.BASE_PATH ?? '/edytor-pdf/';
/** Set to the published address to run the smoke test against the live site. */
const DEPLOYED_URL = process.env.E2E_BASE_URL;
/** Optional path to a locally installed Chrome when Playwright's browsers cannot be downloaded. */
const CHROME_PATH = process.env.PW_CHROME_PATH;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: DEPLOYED_URL ?? `http://localhost:${PORT}${BASE_PATH}`,
    locale: 'pl-PL',
    trace: 'retain-on-failure',
  },
  projects:
    DEPLOYED_URL === undefined
      ? [
          {
            name: 'chromium',
            testIgnore: /smoke\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              ...(CHROME_PATH === undefined
                ? {}
                : { launchOptions: { executablePath: CHROME_PATH } }),
            },
          },
          {
            name: 'firefox',
            testIgnore: /smoke\.spec\.ts/,
            use: { ...devices['Desktop Firefox'] },
          },
        ]
      : [{ name: 'smoke', testMatch: /smoke\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }],
  ...(DEPLOYED_URL === undefined
    ? {
        webServer: {
          command: `npx vite preview --port ${PORT} --strictPort`,
          url: `http://localhost:${PORT}${BASE_PATH}`,
          reuseExistingServer: process.env.CI === undefined,
        },
      }
    : {}),
});
