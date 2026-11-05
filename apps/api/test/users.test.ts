import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { User } from '../src/models';
import { createUser, loginAs, PASSWORD, PNG_BYTES, useTestApp } from './helpers';

const ctx = useTestApp();

const avatarFiles = () => {
  const dir = path.join(ctx.config.uploadDir, 'avatars');
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

describe('account', () => {
  it('requires a login', async () => {
    await request(ctx.app).patch('/api/me').send({ name: 'Hacker' }).expect(401);
    await request(ctx.app).delete('/api/me/avatar').expect(401);
    await request(ctx.app).patch('/api/me/password').send({}).expect(401);
  });

  it('only ever changes the logged in user – other accounts are untouched', async () => {
    const victim = await createUser('customer', { name: 'Victim' });
    const { agent, user } = await loginAs(ctx, 'customer');

    const res = await agent
      .patch('/api/me')
      .send({ name: 'New Name', id: victim.id, _id: victim.id });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.name).toBe('New Name');
    expect((await User.findById(victim.id))?.name).toBe('Victim');
  });

  it('rejects an empty update and an invalid name', async () => {
    const { agent } = await loginAs(ctx, 'customer');
    await agent.patch('/api/me').send({}).expect(400);
    await agent.patch('/api/me').send({ name: 'x' }).expect(400);
  });

  it('uploads an avatar, serves it, and replaces the old file', async () => {
    const { agent } = await loginAs(ctx, 'customer');

    const first = await agent.patch('/api/me').attach('avatar', PNG_BYTES, 'me.png');
    expect(first.status).toBe(200);
    expect(first.body.avatarUrl).toMatch(/^\/uploads\/avatars\/[0-9a-f-]{36}\.png$/);
    expect(avatarFiles()).toHaveLength(1);

    const served = await request(ctx.app).get(first.body.avatarUrl as string);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');

    const second = await agent.patch('/api/me').attach('avatar', PNG_BYTES, 'again.png');
    expect(second.status).toBe(200);
    expect(second.body.avatarUrl).not.toBe(first.body.avatarUrl);
    expect(avatarFiles()).toHaveLength(1); // the old file was removed

    const removed = await agent.delete('/api/me/avatar');
    expect(removed.body.avatarUrl).toBeNull();
    expect(avatarFiles()).toHaveLength(0);
  });

  it('refuses files that are not real images and leaves nothing behind', async () => {
    const { agent } = await loginAs(ctx, 'customer');
    const fakePng = Buffer.from('<?php echo "not an image"; ?>');

    const disguised = await agent
      .patch('/api/me')
      .attach('avatar', fakePng, { filename: 'a.png', contentType: 'image/png' });
    expect(disguised.status).toBe(400);

    const wrongType = await agent
      .patch('/api/me')
      .attach('avatar', PNG_BYTES, { filename: 'a.html', contentType: 'text/html' });
    expect(wrongType.status).toBe(400);

    const wrongExt = await agent
      .patch('/api/me')
      .attach('avatar', PNG_BYTES, { filename: 'a.exe', contentType: 'image/png' });
    expect(wrongExt.status).toBe(400);

    expect(avatarFiles()).toHaveLength(0);
  });

  it('refuses files over 5 MB', async () => {
    const { agent } = await loginAs(ctx, 'customer');
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(5 * 1024 * 1024 + 10)]);
    const res = await agent
      .patch('/api/me')
      .attach('avatar', big, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
    expect(avatarFiles()).toHaveLength(0);
  });

  it('removes the uploaded file when the rest of the request is invalid', async () => {
    const { agent } = await loginAs(ctx, 'customer');
    const res = await agent
      .patch('/api/me')
      .field('name', 'x')
      .attach('avatar', PNG_BYTES, 'me.png');
    expect(res.status).toBe(400);
    expect(avatarFiles()).toHaveLength(0);
  });

  it('changes the password only with the correct current one', async () => {
    const { agent, user } = await loginAs(ctx, 'customer');

    const wrong = await agent
      .patch('/api/me/password')
      .send({ currentPassword: 'nope-nope', newPassword: 'brand-new-pass' });
    expect(wrong.status).toBe(400);

    const weak = await agent
      .patch('/api/me/password')
      .send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(weak.status).toBe(400);

    await agent
      .patch('/api/me/password')
      .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass' })
      .expect(204);

    await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(401);
    await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'brand-new-pass' })
      .expect(200);
  });
});
