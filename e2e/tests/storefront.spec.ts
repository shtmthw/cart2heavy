import { createProducts, expect, test } from '../support';

test.describe('storefront', () => {
  test('home shows the shop, most bought, categories and sorting', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Everything for your build',
    );
    await expect(page.getByRole('heading', { name: 'Most bought' })).toBeVisible();
    await expect(
      page.getByRole('list').filter({ hasText: 'bought' }).getByRole('listitem'),
    ).toHaveCount(3);

    // category chips filter the grid and are kept in the URL
    await page.getByRole('button', { name: 'Laptops' }).click();
    await expect(page).toHaveURL(/category=laptops/);
    const cards = page.getByRole('heading', { level: 3 });
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('MacBook');
    await expect(page.getByRole('button', { name: 'Laptops' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // sorting by price, low to high
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page).not.toHaveURL(/category=/);
    await page.getByLabel('Sort products').selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page.getByRole('heading', { level: 3 }).first()).toContainText(
      'ASUS ROG Strix B450-F',
    );
  });

  test('pagination: the 13th product moves to page 2, and the page survives a reload', async ({
    page,
    playwright,
  }) => {
    const extra = await createProducts(playwright, ['E2E page product 1', 'E2E page product 2']);
    try {
      await page.goto('/');
      const nav = page.getByRole('navigation', { name: 'Pagination' });
      await expect(nav).toContainText('Page 1 of 2'); // 14 products, 12 per page
      await expect(page.getByRole('heading', { level: 3 })).toHaveCount(12);

      await nav.getByRole('button', { name: 'Next' }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(nav).toContainText('Page 2 of 2');
      await expect(page.getByRole('heading', { level: 3 })).toHaveCount(2);

      await page.reload();
      await expect(nav).toContainText('Page 2 of 2');
      await nav.getByRole('button', { name: 'Previous' }).click();
      await expect(nav).toContainText('Page 1 of 2');
    } finally {
      await extra.remove();
    }
  });

  test('a product page survives a refresh (the old app broke here)', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /ASUS ROG Strix Z690-A Gaming WiFi/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'ASUS ROG Strix Z690-A Gaming WiFi',
    );
    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'ASUS ROG Strix Z690-A Gaming WiFi',
    );
    await expect(page.getByText('$349.99').first()).toBeVisible();

    await page.goto('/products/507f1f77bcf86cd799439011');
    await expect(page.getByText('This product is not available')).toBeVisible();
  });

  test('instant search: dropdown, keyboard, results page', async ({ page }) => {
    await page.goto('/');
    const box = page.getByRole('combobox', { name: 'Search products' });
    await box.fill('b450');
    const list = page.getByRole('listbox', { name: 'Suggestions' });
    await expect(list.getByRole('option')).toHaveCount(1);
    await expect(list).toContainText('B450-F');

    await box.fill('asus');
    await expect(list.getByRole('option')).toHaveCount(5);
    await box.press('ArrowDown');
    await box.press('ArrowDown');
    await expect(list.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await box.press('Escape');
    await expect(list).toBeHidden();

    // Enter without choosing a suggestion opens the results page (Escape cleared the field)
    await box.fill('asus');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=asus/);
    await expect(page.getByRole('heading', { name: 'Results for “asus”' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(5);

    await box.fill('zzzzzz');
    await box.press('Enter');
    await expect(page.getByText('No products found')).toBeVisible();

    // choosing a suggestion with the keyboard opens the product
    await box.fill('iphone 15 pro');
    await expect(list.getByRole('option')).toHaveCount(1);
    await box.press('ArrowDown');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/products\//);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Apple iPhone 15 Pro (256 GB)',
    );
  });

  test('the guest cart lives in the browser, survives a reload and shows the minimum order rule', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add ASUS ROG Strix B450-F Gaming to cart' }).click();
    await expect(page.getByText('ASUS ROG Strix B450-F Gaming added to your cart')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();

    await page.getByRole('link', { name: 'Cart, 1 item' }).click();
    await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
    const summary = page.getByRole('complementary', { name: 'Order summary' });
    await expect(summary).toContainText('Subtotal$119.99');
    await expect(summary).toContainText('Delivery$1.80');
    await expect(summary).toContainText('Total$121.79');

    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(summary).toContainText('Subtotal$239.98');
    await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();

    await page.getByRole('button', { name: 'Remove ASUS ROG Strix B450-F Gaming' }).click();
    await expect(page.getByText('Your cart is empty')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cart, empty' })).toBeVisible();
  });

  test('unknown pages get a friendly 404', async ({ page }) => {
    await page.goto('/this/does/not/exist');
    await expect(page.getByText('Page not found')).toBeVisible();
    await page.getByRole('link', { name: 'Back to the shop' }).click();
    await expect(page).toHaveURL('/');
  });
});
