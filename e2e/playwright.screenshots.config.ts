import { defineConfig, devices } from '@playwright/test';
import { baseURL } from './stack';

/** `pnpm screenshots` – takes the pictures used in README.md, on a freshly seeded stack. */
export default defineConfig({
  testDir: './screenshots',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  },
});
