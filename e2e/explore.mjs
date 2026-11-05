import { chromium } from '@playwright/test';
const out = process.argv[2];
const base = 'http://localhost:5173';
const browser = await chromium.launch();
const problems = [];
async function login(email, password, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  return page;
}
const admin = await login('admin@cart2heavy.local', 'admin1234', { width: 1280, height: 860 });
await admin.getByRole('heading', { name: 'Dashboard' }).waitFor();
console.log(
  'waiting for you:',
  await admin.getByRole('link', { name: /Waiting for you/ }).innerText(),
);
await admin.goto(`${base}/admin/orders?status=processing&payment=paid`);
await admin
  .getByRole('button', { name: /Open order/ })
  .first()
  .click();
await admin.getByRole('dialog').getByRole('button', { name: 'Confirm order' }).waitFor();
await admin.screenshot({ path: `${out}/admin-order.png` });

const mob = await login('admin@cart2heavy.local', 'admin1234', { width: 390, height: 844 });
await mob.getByRole('heading', { name: 'Dashboard' }).waitFor();
await mob.goto(`${base}/admin/products`);
await mob.getByRole('heading', { name: 'Products' }).waitFor();
await mob.waitForLoadState('networkidle');
await mob.screenshot({ path: `${out}/mobile-admin-products.png` });
const lm = await login('logistics@cart2heavy.local', 'logistics1234', { width: 390, height: 844 });
await lm.getByRole('heading', { name: 'Queue' }).waitFor();
await lm.waitForLoadState('networkidle');
await lm.screenshot({ path: `${out}/mobile-logistics.png` });
console.log('console problems:', problems);
await browser.close();
