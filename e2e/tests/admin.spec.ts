import { expect, logInAs, PNG, test } from '../support';

test.describe('admin catalog', () => {
  test('creates, edits and deletes a product with a photo; the shop shows every change', async ({
    page,
  }) => {
    await logInAs(page, 'admin');
    await page.goto('/admin/products');
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();

    await page.getByRole('button', { name: 'New product' }).click();
    const dialog = page.getByRole('dialog');

    // empty form: every problem is named
    await dialog.getByRole('button', { name: 'Add product' }).click();
    await expect(dialog.getByText('Choose a photo')).toBeVisible();
    await expect(dialog.getByText('Enter a price like 249.99')).toBeVisible();
    await expect(dialog.getByText('Choose a category')).toBeVisible();

    await dialog
      .getByLabel('Product photo')
      .setInputFiles({ name: 'board.png', mimeType: 'image/png', buffer: PNG });
    await expect(dialog.getByAltText('Product preview')).toBeVisible();
    await dialog.getByLabel('Name').fill('E2E Test Motherboard');
    await dialog.getByLabel('Description').fill('Created by the end-to-end test.');
    await dialog.getByLabel('Price (USD)').fill('249.99');
    await dialog.getByLabel('Category').selectOption({ label: 'Motherboards' });
    await dialog.getByRole('button', { name: 'Add product' }).click();
    await expect(page.getByText('Product added')).toBeVisible();
    const row = page.getByRole('row', { name: /E2E Test Motherboard/ });
    await expect(row).toContainText('$249.99');
    await expect(row).toContainText('Visible');

    // customers can find and open it
    await page.goto('/search?q=E2E+Test');
    await expect(
      page.getByRole('heading', { level: 3, name: 'E2E Test Motherboard' }),
    ).toBeVisible();
    await page.getByRole('link', { name: /E2E Test Motherboard/ }).click();
    await expect(page.getByText('$249.99').first()).toBeVisible();
    await expect(page.getByRole('img', { name: 'E2E Test Motherboard' })).toHaveAttribute(
      'src',
      /\/uploads\/products\/.+\.png/,
    );

    // edit: new price, hide it from the shop
    await page.goto('/admin/products');
    await page.getByRole('button', { name: 'Edit E2E Test Motherboard' }).click();
    await page.getByRole('dialog').getByLabel('Price (USD)').fill('199.50');
    await page.getByRole('dialog').getByLabel('Visible in the shop').uncheck();
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Product saved')).toBeVisible();
    await expect(page.getByRole('row', { name: /E2E Test Motherboard/ })).toContainText('$199.50');
    await expect(page.getByRole('row', { name: /E2E Test Motherboard/ })).toContainText('Hidden');
    await page.goto('/search?q=E2E+Test');
    await expect(page.getByText('No products found')).toBeVisible();

    // delete (never ordered, so it really goes away)
    await page.goto('/admin/products');
    await page.getByRole('button', { name: 'Delete E2E Test Motherboard' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Product deleted')).toBeVisible();
    await expect(page.getByRole('row', { name: /E2E Test Motherboard/ })).toHaveCount(0);
  });

  test('manages categories and protects the ones in use', async ({ page }) => {
    await logInAs(page, 'admin');
    await page.goto('/admin/categories');
    await page.getByRole('button', { name: 'New category' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill('E2E Accessories');
    await page.getByRole('dialog').getByLabel('Package size').selectOption('small');
    await page.getByRole('dialog').getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByRole('row', { name: /E2E Accessories/ })).toContainText('S · Small');

    // the same name again is refused
    await page.getByRole('button', { name: 'New category' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill('e2e accessories');
    await page.getByRole('dialog').getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
      'A category with this name already exists',
    );
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Edit E2E Accessories' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill('E2E Gadgets');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('row', { name: /E2E Gadgets/ })).toBeVisible();

    await page.getByRole('button', { name: 'Delete E2E Gadgets' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Category deleted')).toBeVisible();

    // a category with products cannot be deleted
    await page.getByRole('button', { name: 'Delete Phones' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/products are still in this category/)).toBeVisible();
    await expect(page.getByRole('row', { name: /Phones/ })).toBeVisible();
  });

  test('the dashboard and the order filters work', async ({ page }) => {
    await logInAs(page, 'admin');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Revenue', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Orders by status' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Most bought' })).toBeVisible();

    await page.goto('/admin/orders');
    await page.getByLabel('Filter by status').selectOption('delivered');
    await expect(page).toHaveURL(/status=delivered/);
    // only delivered orders are left in the list (the list refreshes, so wait for it)
    await expect(page.getByRole('row').filter({ hasText: 'Delivered' }).first()).toBeVisible();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: /Processing|Confirmed|Cancelled|Shipped|Being shipped/ }),
    ).toHaveCount(0);
    await page.getByLabel('Filter by payment').selectOption('pending');
    await expect(page.getByText('No orders match these filters')).toBeVisible();
  });
});
