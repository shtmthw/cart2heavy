import {
  expect,
  test as base,
  type Locator,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test';
import { DEMO_PASSWORDS } from '../apps/api/src/seed/data';
import { baseURL, mailURL } from './stack';

export { baseURL, DEMO_PASSWORDS, expect };

/**
 * Like the normal `test`, but a page that throws an uncaught error or logs a console error fails
 * the test. (Failed HTTP requests that a test causes on purpose, like a 409, are not counted.)
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
        problems.push(`console.error: ${message.text()}`);
      }
    });
    await use(page);
    expect(problems, 'the page logged errors').toEqual([]);
  },
});

let counter = 0;
export const uniqueEmail = (prefix = 'shopper') =>
  `${prefix}.${Date.now().toString(36)}${(counter += 1)}@example.test`;

export const ADDRESS = {
  fullName: 'Ada Lovelace',
  line1: '12 Analytical Street',
  city: 'London',
  postalCode: 'N1 9GU',
  country: 'United Kingdom',
  phone: '+44 20 7946 0000',
};

export async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

export async function logInAs(page: Page, who: keyof typeof DEMO_PASSWORDS) {
  await logIn(page, DEMO_PASSWORDS[who].email, DEMO_PASSWORDS[who].password);
}

/** Creates an account through the sign-up form; the new user ends up logged in. */
export async function signUp(page: Page, email = uniqueEmail(), name = 'Ada Lovelace') {
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  return { email, name, password: 'correct-horse-battery' };
}

export async function fillAddress(page: Page | Locator) {
  await page.getByLabel('Full name').fill(ADDRESS.fullName);
  await page.getByLabel('Address', { exact: true }).fill(ADDRESS.line1);
  await page.getByLabel('City').fill(ADDRESS.city);
  await page.getByLabel('Postal code').fill(ADDRESS.postalCode);
  await page.getByLabel('Country').fill(ADDRESS.country);
  await page.getByLabel('Phone').fill(ADDRESS.phone);
}

interface MailSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

/** Emails Mailpit caught for an address (what a customer would have received). */
export async function emailsFor(address: string): Promise<MailSummary[]> {
  const response = await fetch(
    `${mailURL}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
  );
  const body = (await response.json()) as { messages: MailSummary[] };
  return body.messages;
}

/** A tiny valid PNG, for upload tests. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Adds products through the admin API (faster than the form) and returns a function that deletes
 * them again, so a test leaves the shop as it found it.
 */
export async function createProducts(
  playwright: PlaywrightWorkerArgs['playwright'],
  names: string[],
  priceCents = 4_999,
) {
  const api = await playwright.request.newContext({ baseURL });
  const login = await api.post('/api/auth/login', {
    data: { email: DEMO_PASSWORDS.admin.email, password: DEMO_PASSWORDS.admin.password },
  });
  expect(login.ok()).toBe(true);
  const categories = (await (await api.get('/api/admin/categories')).json()) as { id: string }[];

  const ids: string[] = [];
  for (const name of names) {
    const response = await api.post('/api/admin/products', {
      multipart: {
        name,
        description: 'Created by an end-to-end test.',
        priceCents: String(priceCents),
        category: categories[0]!.id,
        image: { name: 'p.png', mimeType: 'image/png', buffer: PNG },
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    ids.push(((await response.json()) as { id: string }).id);
  }
  return {
    ids,
    async remove() {
      for (const id of ids) await api.delete(`/api/admin/products/${id}`);
      await api.dispose();
    },
  };
}
