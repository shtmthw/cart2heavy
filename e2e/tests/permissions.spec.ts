import { baseURL, expect, logInAs, signUp, test } from '../support';

test.describe('who can see what', () => {
  test('visitors are sent to the login page for staff areas', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
    await page.goto('/logistics');
    await expect(page).toHaveURL(/\/login\?next=%2Flogistics/);
  });

  test('a customer gets "no access" in the UI and 403 from the API', async ({ page }) => {
    await signUp(page);
    for (const area of ['/admin', '/admin/orders', '/logistics']) {
      await page.goto(area);
      await expect(page.getByText('You do not have access to this page')).toBeVisible();
    }
    // the API says no as well – hiding the UI is not the protection
    for (const url of ['/api/admin/stats', '/api/admin/orders', '/api/logistics/orders']) {
      const response = await page.request.get(`${baseURL}${url}`);
      expect(response.status(), url).toBe(403);
    }
    const create = await page.request.post(`${baseURL}/api/admin/categories`, {
      data: { name: 'Hacked', weight: 'small' },
    });
    expect(create.status()).toBe(403);
  });

  test('admin and logistics each get their own area and not the other one', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await logInAs(admin, 'admin');
    await expect(admin.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await admin.goto('/logistics');
    await expect(admin.getByText('You do not have access to this page')).toBeVisible();
    expect((await admin.request.get(`${baseURL}/api/logistics/orders`)).status()).toBe(403);
    await adminContext.close();

    const logisticsContext = await browser.newContext();
    const logistics = await logisticsContext.newPage();
    await logInAs(logistics, 'logistics');
    await expect(logistics.getByRole('heading', { name: 'Queue' })).toBeVisible();
    await logistics.goto('/admin');
    await expect(logistics.getByText('You do not have access to this page')).toBeVisible();
    expect((await logistics.request.get(`${baseURL}/api/admin/stats`)).status()).toBe(403);
    await logisticsContext.close();
  });

  test('a customer cannot read or pay for somebody else’s order', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await logInAs(owner, 'demo');
    await owner.goto('/orders');
    const link = owner.getByRole('link', { name: /Order #/ }).first();
    await link.click();
    const orderPath = new URL(owner.url()).pathname; // /orders/<id>
    const id = orderPath.split('/').at(-1)!;
    await ownerContext.close();

    const strangerContext = await browser.newContext();
    const stranger = await strangerContext.newPage();
    await signUp(stranger);
    const read = await stranger.request.get(`${baseURL}/api/orders/${id}`);
    expect(read.status()).toBe(404);
    const verify = await stranger.request.post(`${baseURL}/api/orders/${id}/verify`);
    expect(verify.status()).toBe(404);
    await stranger.goto(orderPath);
    await expect(stranger.getByText('Order not found')).toBeVisible();
    await strangerContext.close();
  });
});
