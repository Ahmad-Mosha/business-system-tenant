import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  createTestApp,
  resetDatabase,
  seedIdentityFixture,
  seedOrder,
  sessionCookie,
  type TestContext,
} from './harness.js';

describe('order assignment and status workflow', () => {
  let ctx: TestContext;
  let fixture: Awaited<ReturnType<typeof seedIdentityFixture>>;
  let orderId: string;

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
    orderId = await seedOrder(ctx.db, { organizationId: fixture.organizationId });
  });

  const login = async (email: string, password: string) =>
    sessionCookie(
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200),
    );

  it('hides an unassigned order from a moderator as "not found", not "forbidden"', async () => {
    const cookie = await login(fixture.moderator.email, fixture.moderator.password);
    // A 403 would confirm the order exists. Absence must look like absence.
    await request(ctx.app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('lets an admin assign, which makes the order visible to that moderator', async () => {
    const admin = await login(fixture.admin.email, fixture.admin.password);
    await request(ctx.app.getHttpServer())
      .post(`/orders/${orderId}/assign`)
      .set('Cookie', admin)
      .send({ assigneeId: fixture.moderator.id })
      .expect(204);

    const mod = await login(fixture.moderator.email, fixture.moderator.password);
    const res = await request(ctx.app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Cookie', mod)
      .expect(200);
    expect(res.body.assignedTo.id).toBe(fixture.moderator.id);
  });

  it('refuses to let a moderator assign work', async () => {
    const cookie = await login(fixture.moderator.email, fixture.moderator.password);
    const res = await request(ctx.app.getHttpServer())
      .post(`/orders/${orderId}/assign`)
      .set('Cookie', cookie)
      .send({ assigneeId: fixture.moderator.id })
      .expect(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('rejects an assignee from another organization', async () => {
    const admin = await login(fixture.admin.email, fixture.admin.password);
    const outsider = '00000000-0000-4000-8000-000000000000';
    const res = await request(ctx.app.getHttpServer())
      .post(`/orders/${orderId}/assign`)
      .set('Cookie', admin)
      .send({ assigneeId: outsider })
      .expect(422);
    expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
  });

  it('keeps the previous holder in history when an order is reassigned', async () => {
    const admin = await login(fixture.admin.email, fixture.admin.password);
    const server = ctx.app.getHttpServer();

    await request(server)
      .post(`/orders/${orderId}/assign`)
      .set('Cookie', admin)
      .send({ assigneeId: fixture.moderator.id })
      .expect(204);
    await request(server)
      .post(`/orders/${orderId}/assign`)
      .set('Cookie', admin)
      .send({ assigneeId: fixture.otherModerator.id })
      .expect(204);

    const res = await request(server).get(`/orders/${orderId}`).set('Cookie', admin).expect(200);
    const assignments = res.body.timeline.filter((e: { kind: string }) => e.kind === 'ASSIGNMENT');
    expect(assignments).toHaveLength(2);
    expect(res.body.assignedTo.id).toBe(fixture.otherModerator.id);
  });

  it('allows only legal status transitions', async () => {
    const admin = await login(fixture.admin.email, fixture.admin.password);
    const server = ctx.app.getHttpServer();

    // NEW cannot jump straight to SHIPPED.
    const bad = await request(server)
      .post(`/orders/${orderId}/status`)
      .set('Cookie', admin)
      .send({ status: 'SHIPPED' })
      .expect(422);
    expect(bad.body.error.code).toBe('INVALID_TRANSITION');

    await request(server)
      .post(`/orders/${orderId}/status`)
      .set('Cookie', admin)
      .send({ status: 'CONTACTED' })
      .expect(204);
  });

  it('records who changed a status, and why', async () => {
    const admin = await login(fixture.admin.email, fixture.admin.password);
    const server = ctx.app.getHttpServer();
    await request(server)
      .post(`/orders/${orderId}/status`)
      .set('Cookie', admin)
      .send({ status: 'CONTACTED', note: 'Customer confirmed by phone' })
      .expect(204);

    const res = await request(server).get(`/orders/${orderId}`).set('Cookie', admin).expect(200);
    const change = res.body.timeline.find((e: { kind: string }) => e.kind === 'STATUS');
    expect(change.title).toBe('NEW → CONTACTED');
    expect(change.detail).toBe('Customer confirmed by phone');
    expect(change.actorName).toBe('Admin');
  });

  it('rejects DELIVERED outright - the courier owns that fact, not a person', async () => {
    const admin = await login(fixture.admin.email, fixture.admin.password);
    const res = await request(ctx.app.getHttpServer())
      .post(`/orders/${orderId}/status`)
      .set('Cookie', admin)
      .send({ status: 'DELIVERED' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
