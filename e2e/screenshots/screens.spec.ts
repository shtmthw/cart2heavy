import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { DEMO_PASSWORDS } from '../../apps/api/src/seed/data';

/**
 * Takes the pictures for README.md on a freshly seeded stack:
 *   pnpm screenshots   ->   docs/screenshots/*.png
 */
const out = path.resolve(import.meta.dirname, '../../docs/screenshots');
const shot = (name: string) => path.join(out, `${name}.png`);

/** toasts ("Welcome back…") are not part of the picture */
async function hideToasts(context: BrowserContext) {
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '[data-sonner-toaster]{display:none!important}';
      document.head.append(style);
    });
  });
}

async function logIn(page: Page, who: keyof typeof DEMO_PASSWORDS) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(DEMO_PASSWORDS[who].email);
  await page.getByLabel('Password').fill(DEMO_PASSWORDS[who].password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  // product photos are lazy: wait until every visible one has loaded
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
}

test.describe.configure({ mode: 'serial' });

test('storefront', async ({ page, context }) => {
  await hideToasts(context);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Most bought' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('home') });

  await page
    .getByRole('link', { name: /MSI MEG Z790 GODLIKE/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('product') });

  // instant search
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Search products' }).fill('msi');
  await expect(page.getByRole('listbox', { name: 'Suggestions' }).getByRole('option')).toHaveCount(
    5,
  );
  await page.getByRole('combobox', { name: 'Search products' }).press('ArrowDown');
  await settle(page);
  await page.screenshot({ path: shot('search'), clip: { x: 0, y: 0, width: 1280, height: 460 } });
});

test('cart, checkout and order tracking', async ({ page, context }) => {
  await hideToasts(context);
  await logIn(page, 'demo');
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: 'Add MSI MEG Z790 ACE to cart' }).click();
  await page.getByRole('button', { name: 'Add Apple iPhone 15 Pro (256 GB) to cart' }).click();
  await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('cart'), clip: { x: 0, y: 0, width: 1280, height: 520 } });

  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveValue('Demo Customer'); // from the last order
  await settle(page);
  await page.screenshot({ path: shot('checkout'), clip: { x: 0, y: 0, width: 1280, height: 640 } });

  // the shipped demo order shows how far the parcel has come
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('orders'), clip: { x: 0, y: 0, width: 1280, height: 640 } });
  await page
    .getByRole('link', { name: /Order #.*Shipped/ })
    .first()
    .click();
  await expect(page.getByRole('list', { name: 'Order progress' })).toBeVisible();
  await settle(page);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.screenshot({ path: shot('order-timeline') });
});

test('admin', async ({ page, context }) => {
  await hideToasts(context);
  await logIn(page, 'admin');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('admin-dashboard') });

  await page.getByRole('link', { name: 'Products' }).click();
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(11); // header + 10 per page
  await settle(page);
  await page.screenshot({ path: shot('admin-products') });

  await page.goto('/admin/orders?status=processing&payment=paid');
  await page
    .getByRole('button', { name: /^Open order/ })
    .first()
    .click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Confirm order' }),
  ).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('admin-order') });
});

test('logistics', async ({ page, context }) => {
  await hideToasts(context);
  await logIn(page, 'logistics');
  await expect(page.getByRole('heading', { name: 'Queue' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('logistics') });
});

test('mobile and dark mode', async ({ browser }) => {
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await hideToasts(phone);
  const mobile = await phone.newPage();
  await mobile.goto('/');
  await expect(mobile.getByRole('heading', { name: 'Most bought' })).toBeVisible();
  await settle(mobile);
  await mobile.screenshot({ path: shot('mobile-home') });
  await mobile.getByRole('button', { name: 'Add Apple iPhone 15 (128 GB) to cart' }).click();
  await mobile.goto('/cart');
  await expect(mobile.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await settle(mobile);
  await mobile.screenshot({ path: shot('mobile-cart') });
  await phone.close();

  const dark = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  await hideToasts(dark);
  const page = await dark.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Most bought' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: shot('home-dark') });
  await dark.close();
});
