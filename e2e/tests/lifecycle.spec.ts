import { emailsFor, expect, fillAddress, logInAs, signUp, test } from '../support';

/**
 * The heart of the app: one order travelling through all three roles.
 *   customer pays -> admin confirms -> logistics moves it step by step -> customer sees every step
 */
test('an order goes from processing to delivered, and the customer sees each step', async ({
  browser,
  page: customer,
}) => {
  test.setTimeout(120_000);

  // --- the customer buys a phone and a motherboard
  const shopper = await signUp(customer);
  await customer.goto('/');
  await customer.getByRole('button', { name: 'Add Apple iPhone 15 (128 GB) to cart' }).click();
  await customer.getByRole('button', { name: 'Add MSI MAG B760 TOMAHAWK WIFI to cart' }).click();
  await customer.getByRole('link', { name: 'Cart, 2 items' }).click();
  await customer.getByRole('button', { name: 'Checkout' }).click();
  await fillAddress(customer);
  await customer.getByRole('button', { name: /Continue to payment/ }).click();
  await customer.getByRole('button', { name: /^Pay / }).click();
  await expect(customer.getByRole('heading', { name: /payment was received/ })).toBeVisible();
  await customer.getByRole('link', { name: 'Track your order' }).click();
  const orderUrl = customer.url();
  const orderNumber = (
    await customer.getByRole('heading', { name: /^Order #/ }).innerText()
  ).replace('Order ', '');
  await expect(customer.locator('[aria-current="step"]')).toContainText('Processing');

  // --- the admin sees it, waiting to be confirmed
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await logInAs(admin, 'admin');
  await expect(admin.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await admin.goto('/admin/orders?status=processing&payment=paid');
  await expect(admin.getByRole('row', { name: new RegExp(orderNumber) })).toBeVisible();
  await admin.getByRole('button', { name: `Open order ${orderNumber}` }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog).toContainText(shopper.email);
  await expect(dialog).toContainText('Apple iPhone 15 (128 GB)');
  await dialog.getByRole('button', { name: 'Confirm order' }).click();
  await expect(admin.getByText('Order confirmed')).toBeVisible();

  // --- logistics: the order shows up with its package size; step through every stage
  const logisticsContext = await browser.newContext();
  const logistics = await logisticsContext.newPage();
  await logInAs(logistics, 'logistics');
  await expect(logistics.getByRole('heading', { name: 'Queue' })).toBeVisible();
  const card = logistics
    .locator('div', { has: logistics.getByText(orderNumber, { exact: true }) })
    .filter({ hasText: 'Ada Lovelace' })
    .last();
  await expect(card).toContainText('Size M · Medium'); // the heaviest item decides (motherboard: medium)
  await expect(card).toContainText('12 Analytical Street');

  const steps = [
    'Mark as received',
    'Start shipping',
    'Mark as shipped',
    'Out for delivery',
    'Mark as delivered',
  ];
  for (const step of steps) {
    await card.getByRole('button', { name: step }).click();
    await expect(logistics.getByText(new RegExp(`${orderNumber} → `))).toBeVisible();
    if (step !== steps.at(-1))
      await logistics.getByText(new RegExp(`${orderNumber} → `)).waitFor({ state: 'detached' });
  }
  // finished orders leave the default queue
  await expect(logistics.getByText(orderNumber, { exact: true })).toBeHidden();
  await logistics.getByLabel('Filter by status').selectOption('delivered');
  await expect(logistics.getByText(orderNumber, { exact: true })).toBeVisible();

  // --- back to the customer: every step is on the timeline
  await customer.goto(orderUrl);
  await expect(customer.locator('[aria-current="step"]')).toContainText('Delivered');
  const timeline = customer.getByRole('list', { name: 'Order progress' });
  for (const label of [
    'Processing',
    'Confirmed',
    'Received by logistics',
    'Being shipped',
    'Shipped',
    'Out for delivery',
    'Delivered',
  ]) {
    await expect(timeline.getByRole('listitem').filter({ hasText: label }).first()).toBeVisible();
  }
  await customer.goto('/orders');
  await expect(customer.getByRole('link', { name: new RegExp(orderNumber) })).toContainText(
    'Delivered',
  );

  // --- and the emails: received, confirmed, shipped, delivered
  await expect
    .poll(
      async () => (await emailsFor(shopper.email)).map((m) => m.Subject.split(': ').at(-1)).sort(),
      { timeout: 15_000 },
    )
    .toEqual(expect.arrayContaining(['confirmed', 'delivered', 'shipped']));
  expect((await emailsFor(shopper.email)).some((m) => m.Subject.includes('received'))).toBe(true);

  await adminContext.close();
  await logisticsContext.close();
});

test('the admin can cancel an order that is still processing', async ({
  browser,
  page: customer,
}) => {
  await signUp(customer);
  await customer.goto('/');
  await customer.getByRole('button', { name: 'Add Apple iPhone 15 Pro (256 GB) to cart' }).click();
  await customer.getByRole('link', { name: 'Cart, 1 item' }).click();
  await customer.getByRole('button', { name: 'Checkout' }).click();
  await fillAddress(customer);
  await customer.getByRole('button', { name: /Continue to payment/ }).click();
  await customer.getByRole('button', { name: /^Pay / }).click();
  await customer.getByRole('link', { name: 'Track your order' }).click();
  const orderUrl = customer.url();
  const orderNumber = (
    await customer.getByRole('heading', { name: /^Order #/ }).innerText()
  ).replace('Order ', '');

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await logInAs(admin, 'admin');
  await admin.goto('/admin/orders?status=processing');
  await admin.getByRole('button', { name: `Open order ${orderNumber}` }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
  await admin
    .getByRole('dialog', { name: /^Cancel order #/ })
    .getByRole('button', { name: 'Cancel order' })
    .click();
  await expect(admin.getByText('Order cancelled')).toBeVisible();

  await customer.goto(orderUrl);
  await expect(customer.getByText('Cancelled').first()).toBeVisible();
  await adminContext.close();
});
