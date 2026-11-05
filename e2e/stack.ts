/** Where the stack that the tests talk to lives. Used by the configs, the global setup and the tests. */
export const appPort = process.env.E2E_APP_PORT ?? '8081';
export const mailPort = process.env.E2E_MAIL_PORT ?? '8026';

/** `E2E_BASE_URL` points the tests at a stack that is already running (e.g. your `docker compose up`). */
export const usesExistingStack = !!process.env.E2E_BASE_URL;
export const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${appPort}`;
export const mailURL =
  process.env.E2E_MAIL_URL ??
  (usesExistingStack ? 'http://localhost:8025' : `http://localhost:${mailPort}`);
