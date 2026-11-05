import { defineConfig, devices } from '@playwright/test';
import { baseURL } from './stack';

/**
 * End-to-end tests. They run against the real thing: the Docker image started with
 * `docker compose` (app + MongoDB + Mailpit), with demo data.
 *
 *   pnpm e2e                                   builds and starts its own stack on :8081, then removes it
 *   E2E_BASE_URL=http://localhost:8080 pnpm e2e   uses a stack that is already running instead
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false, // the tests share one database
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
