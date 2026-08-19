import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  createTestApp,
  resetDatabase,
  seedIdentityFixture,
  seedOrder,
  seedOrganization,
  seedRole,
  seedUser,
  sessionCookie,
  type TestContext,
} from './harness.js';

/**
 * The authorization tests that matter. Every assertion here goes through the HTTP API,
 * because that is the boundary an attacker reaches - not the UI, which is only a
 * rendering of what the API already decided to return.
 */
describe('order access scoping', () => {
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

  async function login(email: string, password: string): Promise<string> {
    const res = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return sessionCookie(res);
  }

  it('shows an admin every order in the organization', async () => {
    await seedOrder(ctx.db, {
      organizationId: fixture.organizationId,
      assignedToUserId: fixture.moderator.id,
    });
    await seedOrder(ctx.db, {
      organizationId: fixture.organizationId,
      assignedToUserId: fixture.otherModerator.id,
    });
    await seedOrder(ctx.db, { organizationId: fixture.organizationId, assignedToUserId: null });

    const cookie = await login(fixture.admin.email, fixture.admin.password);
    const res = await request(ctx.app.getHttpServer())
      .get('/orders')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.items).toHaveLength(3);
    expect(res.body.total).toBe(3);
  });

  it('shows a moderator only the orders assigned to them', async () => {
    const mine = await seedOrder(ctx.db, {
      organizationId: fixture.organizationId,
      assignedToUserId: fixture.moderator.id,
      customerName: 'Mine',
    });
    await seedOrder(ctx.db, {
      organizationId: fixture.organizationId,
      assignedToUserId: fixture.otherModerator.id,
      customerName: 'Not mine',
    });
    await seedOrder(ctx.db, {
      organizationId: fixture.organizationId,
      assignedToUserId: null,
      customerName: 'Unassigned',
    });

    const cookie = await login(fixture.moderator.email, fixture.moderator.password);
    const res = await request(ctx.app.getHttpServer())
      .get('/orders')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(mine);
    expect(res.body.total).toBe(1);
    // The response must not carry other moderators' orders in any form.
    expect(JSON.stringify(res.body)).not.toContain('Not mine');
    expect(JSON.stringify(res.body)).not.toContain('Unassigned');
  });

  it('never leaks orders from another organization', async () => {
    const otherOrg = await seedOrganization(ctx.db, 'Other Org');
    await seedOrder(ctx.db, { organizationId: otherOrg, customerName: 'Other org customer' });
    await seedOrder(ctx.db, {
      organizationId: fixture.organizationId,
      assignedToUserId: fixture.moderator.id,
    });

    const cookie = await login(fixture.admin.email, fixture.admin.password);
    const res = await request(ctx.app.getHttpServer())
      .get('/orders')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain('Other org customer');
  });

  it('refuses a user whose role grants no order permission', async () => {
    const roleWithoutOrders = await seedRole(
      ctx.db,
      fixture.organizationId,
      'NO_ACCESS',
      [],
    );
    await seedUser(ctx, {
      organizationId: fixture.organizationId,
      email: 'noaccess@test.local',
      password: 'no-access-password-1234',
      roleId: roleWithoutOrders,
    });

    const cookie = await login('noaccess@test.local', 'no-access-password-1234');
    const res = await request(ctx.app.getHttpServer())
      .get('/orders')
      .set('Cookie', cookie)
      .expect(403);

    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('requires authentication', async () => {
    await request(ctx.app.getHttpServer()).get('/orders').expect(401);
  });

  it('applies scope to the status filter too', async () => {
    await seedOrder(ctx.db, {
      organizationId: fixture.organizationId,
      assignedToUserId: fixture.otherModerator.id,
      status: 'CONFIRMED',
    });

    const cookie = await login(fixture.moderator.email, fixture.moderator.password);
    const res = await request(ctx.app.getHttpServer())
      .get('/orders?status=CONFIRMED')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.items).toHaveLength(0);
  });

  it('rejects an unknown status value instead of ignoring it', async () => {
    const cookie = await login(fixture.admin.email, fixture.admin.password);
    const res = await request(ctx.app.getHttpServer())
      .get('/orders?status=NOT_A_REAL_STATUS')
      .set('Cookie', cookie)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
