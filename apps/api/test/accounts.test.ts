import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAccount } from '../src/seed/accounts';
import { setCookies, useTestApp } from './helpers';

const ctx = useTestApp();

describe('createAccount (pnpm create-user)', () => {
  it('creates an admin that can log in with the generated password', async () => {
    const { user, password } = await createAccount(ctx.config, {
      role: 'admin',
      email: 'Boss@Example.com',
      name: 'The Boss',
    });
    expect(user).toMatchObject({ role: 'admin', email: 'boss@example.com' });
    expect(password).toHaveLength(12);

    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'boss@example.com', password });
    expect(login.status).toBe(200);
    expect(login.body.role).toBe('admin');
    const cookie = setCookies(login)
      .map((c) => c.split(';')[0])
      .join('; ');
    expect((await request(ctx.app).get('/api/admin/stats').set('Cookie', cookie)).status).toBe(200);
  });

  it('uses the password it is given, and can make logistics and customer accounts', async () => {
    const logistics = await createAccount(ctx.config, {
      role: 'logistics',
      email: 'ship@example.com',
      name: 'Shipper',
      password: 'my-own-password',
    });
    expect(logistics.password).toBe('my-own-password');
    await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'ship@example.com', password: 'my-own-password' })
      .expect(200);

    const customer = await createAccount(ctx.config, {
      role: 'customer',
      email: 'c@example.com',
      name: 'Cust',
    });
    expect(customer.user.role).toBe('customer');
  });

  it('refuses duplicates and invalid input', async () => {
    await createAccount(ctx.config, { role: 'admin', email: 'dup@example.com', name: 'Dup One' });
    await expect(
      createAccount(ctx.config, { role: 'logistics', email: 'dup@example.com', name: 'Dup Two' }),
    ).rejects.toThrow(/already exists/);
    await expect(
      createAccount(ctx.config, { role: 'admin', email: 'not-an-email', name: 'X Y' }),
    ).rejects.toThrow();
    await expect(
      createAccount(ctx.config, {
        role: 'admin',
        email: 'a@example.com',
        name: 'A B',
        password: 'short',
      }),
    ).rejects.toThrow();
    await expect(
      createAccount(ctx.config, {
        role: 'superuser' as never,
        email: 'a@example.com',
        name: 'A B',
      }),
    ).rejects.toThrow(/Role must be/);
  });
});
