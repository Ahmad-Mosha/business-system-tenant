import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { schema } from '../src/db/db.module.js';
import {
  createTestApp,
  resetDatabase,
  seedIdentityFixture,
  sessionCookie,
  type TestContext,
} from './harness.js';

describe('authentication', () => {
  let ctx: TestContext;
  let fixture: Awaited<ReturnType<typeof seedIdentityFixture>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    ctx.resetRateLimits();
    await resetDatabase(ctx.db);
    fixture = await seedIdentityFixture(ctx);
  });

  it('signs in with valid credentials and returns the effective grants', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.admin.email, password: fixture.admin.password })
      .expect(200);

    expect(res.body.email).toBe(fixture.admin.email);
    expect(res.body.roles).toEqual(['ADMIN']);
    // Assert the grant we care about is present and unrestricted, rather than pinning
    // the whole list - roles gain permissions as slices land.
    expect(res.body.grants).toContainEqual({ permission: 'order:read', scope: 'ALL' });
    expect(sessionCookie(res)).toMatch(/^cops_session=/);
  });

  it('sets the session cookie as httpOnly so scripts cannot read it', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.admin.email, password: fixture.admin.password })
      .expect(200);

    const raw = res.headers['set-cookie'] as unknown as string[];
    expect(raw[0]).toContain('HttpOnly');
    expect(raw[0]).toContain('SameSite=Lax');
  });

  it('rejects a wrong password without revealing which part was wrong', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.admin.email, password: 'not-the-password' })
      .expect(401);

    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the same error for an unknown email as for a wrong password', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@test.local', password: 'not-the-password' })
      .expect(401);

    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('never returns the password hash', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.admin.email, password: fixture.admin.password })
      .expect(200);

    expect(JSON.stringify(res.body)).not.toContain('$argon2');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('rejects an unauthenticated request to a private route', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/auth/me').expect(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('rejects a forged session cookie', async () => {
    await request(ctx.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', 'cops_session=totally-made-up-token')
      .expect(401);
  });

  it('stops accepting the session cookie after logout', async () => {
    const login = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.admin.email, password: fixture.admin.password })
      .expect(200);
    const cookie = sessionCookie(login);

    await request(ctx.app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(200);
    await request(ctx.app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(204);
    await request(ctx.app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(401);
  });

  it('rejects a disabled account with a distinct error', async () => {
    await ctx.db
      .update(schema.users)
      .set({ status: 'DISABLED' })
      .where(eq(schema.users.id, fixture.admin.id));

    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.admin.email, password: fixture.admin.password })
      .expect(403);

    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('revokes other sessions when the password changes', async () => {
    const server = ctx.app.getHttpServer();
    const first = sessionCookie(
      await request(server)
        .post('/auth/login')
        .send({ email: fixture.admin.email, password: fixture.admin.password })
        .expect(200),
    );
    const second = sessionCookie(
      await request(server)
        .post('/auth/login')
        .send({ email: fixture.admin.email, password: fixture.admin.password })
        .expect(200),
    );

    await request(server)
      .post('/auth/change-password')
      .set('Cookie', second)
      .send({ currentPassword: fixture.admin.password, newPassword: 'a-brand-new-password' })
      .expect(204);

    // The session that made the change survives; the other one is dead.
    await request(server).get('/auth/me').set('Cookie', second).expect(200);
    await request(server).get('/auth/me').set('Cookie', first).expect(401);

    await request(server)
      .post('/auth/login')
      .send({ email: fixture.admin.email, password: 'a-brand-new-password' })
      .expect(200);
  });

  it('rate-limits repeated login attempts', async () => {
    const server = ctx.app.getHttpServer();
    const attempt = () =>
      request(server).post('/auth/login').send({ email: fixture.admin.email, password: 'wrong' });

    // The login route allows 10 attempts per minute.
    for (let i = 0; i < 10; i += 1) {
      await attempt().expect(401);
    }
    const blocked = await attempt().expect(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('validates the request body', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('password');
  });
});
