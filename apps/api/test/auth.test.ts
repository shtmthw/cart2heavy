import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createUser, loginAs, PASSWORD, setCookies, useTestApp } from './helpers';

const ctx = useTestApp();

const newUser = { name: 'Matthew', email: 'matthew@example.com', password: 'a-good-password' };

describe('POST /api/auth/register', () => {
  it('creates a customer, logs them in and never returns the password', async () => {
    const res = await request(ctx.app).post('/api/auth/register').send(newUser);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Matthew',
      email: 'matthew@example.com',
      role: 'customer',
    });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password');
    const cookie = setCookies(res)[0] ?? '';
    expect(cookie).toContain('c2h_token=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('ignores a role sent by the client', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ ...newUser, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('customer');
  });

  it('rejects a second account with the same email (any letter case)', async () => {
    await request(ctx.app).post('/api/auth/register').send(newUser).expect(201);
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ ...newUser, email: 'MATTHEW@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
  });

  it('validates the input and says which field is wrong', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'M', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
  });

  it('answers malformed JSON with a 400, not a 500', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right password', async () => {
    const user = await createUser('customer');
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: user.email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(setCookies(res)[0]).toContain('c2h_token=');
  });

  it('gives the same answer for a wrong password and for an unknown email', async () => {
    const user = await createUser('customer');
    const wrongPassword = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });
    const unknownEmail = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(setCookies(wrongPassword)).toHaveLength(0);
  });

  it('is rate limited when the limiter is on', async () => {
    const limited = createApp(ctx.config, { rateLimit: true });
    let last = 0;
    for (let i = 0; i < 31; i += 1) {
      const res = await request(limited)
        .post('/api/auth/login')
        .send({ email: 'x@example.com', password: 'whatever1' });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe('GET /api/auth/me and POST /api/auth/logout', () => {
  it('says "nobody" (not an error) without a session', async () => {
    const res = await request(ctx.app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it('returns the logged in user', async () => {
    const { agent, user } = await loginAs(ctx, 'customer');
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      role: 'customer',
      avatarUrl: null,
    });
  });

  it('does not accept a tampered or garbage cookie', async () => {
    const { agent } = await loginAs(ctx, 'customer');
    expect((await agent.get('/api/auth/me')).body.user).not.toBeNull();

    const garbage = await request(ctx.app).get('/api/auth/me').set('Cookie', 'c2h_token=not.a.jwt');
    expect(garbage.body).toEqual({ user: null });
    const forged = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEifQ.';
    const unsigned = await request(ctx.app)
      .get('/api/auth/me')
      .set('Cookie', `c2h_token=${forged}`);
    expect(unsigned.body).toEqual({ user: null });
    // and a forged token does not open protected routes either
    await request(ctx.app).get('/api/cart').set('Cookie', `c2h_token=${forged}`).expect(401);
  });

  it('stops working once the user is deleted', async () => {
    const { agent, user } = await loginAs(ctx, 'customer');
    await user.deleteOne();
    expect((await agent.get('/api/auth/me')).body).toEqual({ user: null });
    await agent.get('/api/cart').expect(401);
  });

  it('logout clears the cookie', async () => {
    const { agent } = await loginAs(ctx, 'customer');
    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(setCookies(res)[0]).toMatch(/c2h_token=;/);
    expect((await agent.get('/api/auth/me')).body).toEqual({ user: null });
  });
});

describe('same-origin protection', () => {
  it('blocks state-changing requests that come from another site', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@b.co', password: 'whatever1' });
    expect(res.status).toBe(403);
  });

  it('allows the public URL even when a proxy rewrote the Host header', async () => {
    const user = await createUser('customer');
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('Host', 'app-internal:3000')
      .set('Origin', 'http://localhost:8080') // = APP_URL in the test config
      .send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it('allows the site itself', async () => {
    const user = await createUser('customer');
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('Host', 'localhost:8080')
      .set('Origin', 'http://localhost:8080')
      .send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
  });
});

describe('system endpoints', () => {
  it('GET /api/health reports the database', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: true });
  });

  it('GET /api/config exposes the shop rules', async () => {
    const res = await request(ctx.app).get('/api/config');
    expect(res.body).toEqual({
      currency: 'USD',
      minOrderCents: 2500,
      deliveryCents: 180,
      paymentProvider: 'mock',
    });
  });

  it('unknown API routes are a JSON 404', async () => {
    const res = await request(ctx.app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
