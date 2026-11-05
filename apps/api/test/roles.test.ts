import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authenticate, requireAuth, requireRole } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { createLogger } from '../src/logger';
import { loginAs, useTestApp } from './helpers';
import cookieParser from 'cookie-parser';

const ctx = useTestApp();

/** a tiny app that only has the guards, so the role rules are tested on their own */
function guardedApp() {
  const app = express();
  app.use(cookieParser(), authenticate(ctx.config));
  app.get('/any-user', requireAuth, (_req, res) => void res.json({ ok: true }));
  app.get('/admin-only', requireRole('admin'), (_req, res) => void res.json({ ok: true }));
  app.get('/staff', requireRole('admin', 'logistics'), (_req, res) => void res.json({ ok: true }));
  app.use(errorHandler(createLogger({ env: 'test', logLevel: 'silent' })));
  return app;
}

describe('role guard', () => {
  it('401 when not logged in, 403 when logged in with the wrong role, 200 with the right one', async () => {
    const app = guardedApp();
    await request(app).get('/admin-only').expect(401);

    const customer = await loginAs(ctx, 'customer');
    await request(app).get('/admin-only').set('Cookie', customer.cookie).expect(403);
    await request(app).get('/any-user').set('Cookie', customer.cookie).expect(200);
    await request(app).get('/staff').set('Cookie', customer.cookie).expect(403);

    const admin = await loginAs(ctx, 'admin');
    await request(app).get('/admin-only').set('Cookie', admin.cookie).expect(200);
    await request(app).get('/staff').set('Cookie', admin.cookie).expect(200);

    const logistics = await loginAs(ctx, 'logistics');
    await request(app).get('/admin-only').set('Cookie', logistics.cookie).expect(403);
    await request(app).get('/staff').set('Cookie', logistics.cookie).expect(200);
  });

  it('a role change in the database applies on the next request', async () => {
    const { agent, user } = await loginAs(ctx, 'customer');
    expect((await agent.get('/api/auth/me')).body.role).toBe('customer');
    user.role = 'admin';
    await user.save();
    expect((await agent.get('/api/auth/me')).body.role).toBe('admin');
  });
});
