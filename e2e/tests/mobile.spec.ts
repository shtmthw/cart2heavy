import type { Page } from '@playwright/test';
import { DEMO_PASSWORDS, expect, logIn, signUp, test } from '../support';

/** A phone: 390 px wide, touch. Nothing may be wider than the screen, and the key actions must be reachable. */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function expectNoSideScroll(page: Page, where: string) {
  await page.waitForLoadState('networkidle');
  const { scroll, inner } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(scroll, `${where} scrolls sideways (${scroll}px > ${inner}px)`).toBeLessThanOrEqual(inner);
}

test.describe('on a phone', () => {
  test('the storefront fits the screen and the main actions stay in reach', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
    await expectNoSideScroll(page, 'home');

    // the category chips scroll sideways inside their own row, the page itself does not
    await page.getByRole('button', { name: 'Motherboards' }).click();
    await expect(page).toHaveURL(/category=motherboards/);

    await page
      .getByRole('link', { name: /ASUS ROG Strix B450-F/ })
      .first()
      .click();
    await expectNoSideScroll(page, 'product');
    // the sticky "add to cart" bar sits at the bottom of the screen
    const add = page.getByRole('button', { name: 'Add to cart' });
    await expect(add).toBeVisible();
    const box = (await add.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(844 - 100);
    expect(box.height).toBeGreaterThanOrEqual(44); // a finger-sized target
    await add.click();

    await page.getByRole('link', { name: 'Cart, 1 item' }).click();
    await expectNoSideScroll(page, 'cart');
    await expect(page.getByRole('link', { name: 'Log in to check out' })).toBeVisible();
    await page.goto('/login');
    await expectNoSideScroll(page, 'login');
  });

  test('inputs are 16px so iPhones do not zoom in when you tap them', async ({ page }) => {
    await page.goto('/login');
    const size = await page.getByLabel('Email').evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(size)).toBeGreaterThanOrEqual(16);
    const search = await page
      .getByRole('combobox', { name: 'Search products' })
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(search)).toBeGreaterThanOrEqual(16);
  });

  test('a customer can check out from a phone', async ({ page }) => {
    await signUp(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Add ASUS ROG Strix B450-F Gaming to cart' }).click();
    await page.goto('/cart');
    await expectNoSideScroll(page, 'cart');
    await page.getByRole('button', { name: 'Checkout' }).click(); // the sticky one
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expectNoSideScroll(page, 'checkout');
    await page.getByLabel('Full name').fill('Ada Lovelace');
    await page.getByLabel('Address', { exact: true }).fill('12 Analytical Street');
    await page.getByLabel('City').fill('London');
    await page.getByLabel('Postal code').fill('N1 9GU');
    await page.getByLabel('Country').fill('United Kingdom');
    await page.getByLabel('Phone').fill('+44 20 7946 0000');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByRole('heading', { name: 'Test payment' })).toBeVisible();
    await expectNoSideScroll(page, 'payment');
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(page.getByRole('heading', { name: /payment was received/ })).toBeVisible();
    await page.getByRole('link', { name: 'Track your order' }).click();
    await expectNoSideScroll(page, 'order');
    await page.goto('/account');
    await expectNoSideScroll(page, 'account');
  });

  test('the admin panel shows lists as cards, with everything visible and no side scrolling', async ({
    page,
  }) => {
    await logIn(page, DEMO_PASSWORDS.admin.email, DEMO_PASSWORDS.admin.password);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expectNoSideScroll(page, 'dashboard');

    await page.getByRole('link', { name: 'Products' }).click();
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await expectNoSideScroll(page, 'products');
    // price, status and actions are on screen (the desktop table is hidden on phones)
    const card = page.getByRole('listitem').filter({ hasText: 'Apple Mac Studio' }).first();
    await expect(card).toContainText('$1,999.00');
    await expect(card).toContainText('Visible');
    await expect(card.getByRole('button', { name: /^Edit / })).toBeVisible();
    await expect(page.getByRole('table')).toBeHidden();

    await page.getByRole('link', { name: 'Categories' }).click();
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
    await expectNoSideScroll(page, 'categories');

    await page.getByRole('link', { name: 'Orders' }).click();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expectNoSideScroll(page, 'orders');
    await page
      .getByRole('button', { name: /^Open order/ })
      .first()
      .click();
    // the order opens as a bottom sheet that uses the full width
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const sheet = (await dialog.boundingBox())!;
    expect(sheet.width).toBeGreaterThanOrEqual(388);
    expect(sheet.y + sheet.height).toBeGreaterThan(844 - 4); // anchored to the bottom edge
    await expectNoSideScroll(page, 'order dialog');
  });

  test('the logistics queue fits the screen and its action is a full-width button', async ({
    page,
  }) => {
    await logIn(page, DEMO_PASSWORDS.logistics.email, DEMO_PASSWORDS.logistics.password);
    await expect(page.getByRole('heading', { name: 'Queue' })).toBeVisible();
    await expectNoSideScroll(page, 'logistics');
    const action = page
      .getByRole('button', { name: /^(Mark as|Start shipping|Out for delivery)/ })
      .first();
    await expect(action).toBeVisible();
    const box = (await action.boundingBox())!;
    expect(box.width).toBeGreaterThan(300);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});
