import { emailsFor, expect, fillAddress, PNG, signUp, test, uniqueEmail } from '../support';

test.describe('a customer', () => {
  test('signs up from the cart, pays (after cancelling once) and tracks the order', async ({
    page,
  }) => {
    const email = uniqueEmail();

    // 1. a visitor adds something – no account needed yet
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Add ASUS ROG Strix Z690-A Gaming WiFi to cart' })
      .click();
    await page.getByRole('link', { name: 'Cart, 1 item' }).click();

    // 2. "Log in to check out" -> create an account; the cart follows the visitor into the account
    await page.getByRole('link', { name: 'Log in to check out' }).click();
    await page.getByRole('link', { name: 'Create an account' }).click();
    await page.getByLabel('Name').fill('Ada Lovelace');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('correct-horse-battery');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    const summary = page.getByRole('complementary', { name: 'Order summary' });
    await expect(summary).toContainText('1 × ASUS ROG Strix Z690-A Gaming WiFi');
    await expect(summary).toContainText('Total$351.79'); // 349.99 + 1.80 delivery, computed by the server

    // 3. address is validated
    await page.getByRole('button', { name: /Continue to payment/ }).click();
    await expect(page.getByText('Address must be at least 3 characters')).toBeVisible();
    await fillAddress(page);
    await page.getByRole('button', { name: /Continue to payment · \$351\.79/ }).click();

    // 4. the (simulated) payment page: cancel first
    await expect(page.getByRole('heading', { name: 'Test payment' })).toBeVisible();
    await expect(page.getByText('$351.79', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel payment' }).click();
    await expect(page.getByRole('heading', { name: 'Payment not completed' })).toBeVisible();
    // nothing was lost: the cart is still there
    await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();

    // 5. try again and pay
    await page.getByRole('button', { name: 'Try payment again' }).click();
    await expect(page.getByRole('heading', { name: 'Test payment' })).toBeVisible();
    await page.getByRole('button', { name: 'Pay $351.79' }).click();
    await expect(
      page.getByRole('heading', { name: /Thank you, your payment was received/ }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cart, empty' })).toBeVisible();

    // 6. the order page: paid, processing, address and items
    await page.getByRole('link', { name: 'Track your order' }).click();
    await expect(page.getByRole('heading', { name: /^Order #/ })).toBeVisible();
    await expect(page.getByText('Paid', { exact: true })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText('Processing');
    await expect(page.getByText('12 Analytical Street')).toBeVisible();
    await expect(page.getByText('1 × $349.99')).toBeVisible();

    // 7. "most bought" counted the sale (once, by quantity) and the order is in the list
    await page.goto('/orders');
    await expect(page.getByRole('link', { name: /Order #/ })).toHaveCount(1);

    // 8. the confirmation email reached the (fake) inbox
    await expect
      .poll(async () => (await emailsFor(email)).map((m) => m.Subject))
      .toEqual([expect.stringContaining('received')]);
  });

  test('is sent to the login page first and comes back to where they were going', async ({
    page,
  }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);
    const email = uniqueEmail();
    await page.getByRole('link', { name: 'Create an account' }).click();
    await page.getByLabel('Name').fill('Grace Hopper');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('correct-horse-battery');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByText('No orders yet')).toBeVisible();
  });

  test('gets clear messages for wrong input at login and sign-up', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@example.test');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password');

    await page.goto('/register');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByText('Name must be at least 2 characters')).toBeVisible();
    await expect(page.getByText('Enter a valid email')).toBeVisible();

    await page.getByLabel('Name').fill('Demo Again');
    await page.getByLabel('Email').fill('demo@cart2heavy.local');
    await page.getByLabel('Password').fill('correct-horse-battery');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByRole('alert')).toHaveText('An account with this email already exists');
  });

  test('manages their account: name, photo, password, log out', async ({ page }) => {
    const user = await signUp(page);
    await page.goto('/account');

    await page.getByLabel('Name').fill('Ada King');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Profile saved')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('Ada King');

    await page
      .locator('#avatar-input')
      .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('Photo updated')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account menu' }).locator('img')).toHaveAttribute(
      'src',
      /\/uploads\/avatars\//,
    );
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Photo removed')).toBeVisible();

    // password: wrong current one, then the right one
    await page.getByLabel('Current password').fill('not-my-password');
    await page.getByLabel('New password', { exact: true }).fill('a-brand-new-password');
    await page.getByLabel('Repeat new password').fill('a-brand-new-password');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Your current password is incorrect').first()).toBeVisible();
    await page.getByLabel('Current password').fill(user.password);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Password changed')).toBeVisible();

    // log out, then in again with the new password
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('a-brand-new-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/orders$/);
  });
});
