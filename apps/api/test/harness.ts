import { PERMISSIONS, type PermissionScope } from '@app/contracts';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module.js';
import { DB, schema, type Database } from '../src/db/db.module.js';
import { newId } from '../src/shared/ids.js';
import { PasswordService } from '../src/modules/identity/password.service.js';

export interface TestContext {
  app: INestApplication;
  db: Database;
  passwords: PasswordService;
  /** Clears rate-limit counters so one test's logins cannot throttle the next. */
  resetRateLimits: () => void;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  const throttlerStorage = app.get<ThrottlerStorage & { storage?: Map<string, unknown> }>(
    ThrottlerStorage,
  );

  return {
    app,
    db: app.get<Database>(DB),
    passwords: app.get(PasswordService),
    resetRateLimits: () => throttlerStorage.storage?.clear(),
  };
}

/** Wipes every table so each test starts from a known, empty database. */
export async function resetDatabase(db: Database): Promise<void> {
  await db.execute(sql`
    truncate table
      audit_events, sessions, user_roles, role_permissions,
      orders, users, roles, permissions, organizations
    restart identity cascade
  `);
}

let organizationCounter = 0;

export async function seedOrganization(db: Database, name = 'Test Org'): Promise<string> {
  const id = newId();
  organizationCounter += 1;
  // UUIDv7 begins with a timestamp, so its prefix is NOT unique within a millisecond.
  await db.insert(schema.organizations).values({ id, name, slug: `org-${organizationCounter}-${id.slice(-12)}` });
  return id;
}

/** Creates a role holding exactly one grant - enough to exercise scope precisely. */
export async function seedRole(
  db: Database,
  organizationId: string,
  code: string,
  grants: { permission: string; scope: PermissionScope }[],
): Promise<string> {
  const roleId = newId();
  await db.insert(schema.roles).values({ id: roleId, organizationId, code, name: code });
  for (const grant of grants) {
    await db
      .insert(schema.permissions)
      .values({ code: grant.permission, description: grant.permission })
      .onConflictDoNothing();
    await db
      .insert(schema.rolePermissions)
      .values({ roleId, permissionCode: grant.permission, scope: grant.scope });
  }
  return roleId;
}

export async function seedUser(
  ctx: TestContext,
  input: {
    organizationId: string;
    email: string;
    password: string;
    name?: string;
    roleId?: string;
    status?: 'ACTIVE' | 'DISABLED';
  },
): Promise<string> {
  const id = newId();
  await ctx.db.insert(schema.users).values({
    id,
    organizationId: input.organizationId,
    email: input.email.toLowerCase(),
    name: input.name ?? input.email,
    passwordHash: await ctx.passwords.hash(input.password),
    status: input.status ?? 'ACTIVE',
  });
  if (input.roleId) {
    await ctx.db.insert(schema.userRoles).values({ userId: id, roleId: input.roleId });
  }
  return id;
}

let orderCounter = 0;

export async function seedOrder(
  db: Database,
  input: {
    organizationId: string;
    assignedToUserId?: string | null;
    status?: (typeof schema.orderStatus.enumValues)[number];
    customerName?: string;
    grandTotal?: number;
  },
): Promise<string> {
  const id = newId();
  orderCounter += 1;
  await db.insert(schema.orders).values({
    id,
    organizationId: input.organizationId,
    orderNumber: `TEST-${String(orderCounter).padStart(5, '0')}`,
    source: 'MANUAL',
    status: input.status ?? 'NEW',
    assignedToUserId: input.assignedToUserId ?? null,
    customerName: input.customerName ?? 'Test Customer',
    customerPhone: '+201000000000',
    customerPhoneRaw: '01000000000',
    grandTotal: input.grandTotal ?? 10_000,
    placedAt: new Date(),
  });
  return id;
}

/** A standard two-role, two-user fixture: admin sees ALL, moderator sees ASSIGNED. */
export async function seedIdentityFixture(ctx: TestContext) {
  const organizationId = await seedOrganization(ctx.db);
  const adminRole = await seedRole(ctx.db, organizationId, 'ADMIN', [
    { permission: PERMISSIONS.ORDER_READ, scope: 'ALL' },
  ]);
  const moderatorRole = await seedRole(ctx.db, organizationId, 'MODERATOR', [
    { permission: PERMISSIONS.ORDER_READ, scope: 'ASSIGNED' },
  ]);

  const adminPassword = 'admin-password-1234';
  const moderatorPassword = 'moderator-password-1234';

  const adminId = await seedUser(ctx, {
    organizationId,
    email: 'admin@test.local',
    password: adminPassword,
    name: 'Admin',
    roleId: adminRole,
  });
  const moderatorId = await seedUser(ctx, {
    organizationId,
    email: 'moderator@test.local',
    password: moderatorPassword,
    name: 'Moderator',
    roleId: moderatorRole,
  });
  const otherModeratorId = await seedUser(ctx, {
    organizationId,
    email: 'moderator2@test.local',
    password: moderatorPassword,
    name: 'Second Moderator',
    roleId: moderatorRole,
  });

  return {
    organizationId,
    admin: { id: adminId, email: 'admin@test.local', password: adminPassword },
    moderator: { id: moderatorId, email: 'moderator@test.local', password: moderatorPassword },
    otherModerator: {
      id: otherModeratorId,
      email: 'moderator2@test.local',
      password: moderatorPassword,
    },
  };
}

/** Extracts the session cookie from a login response for reuse on later requests. */
export function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : [raw];
  const match = cookies.find((c) => typeof c === 'string' && c.startsWith('cops_session='));
  if (!match) throw new Error('No session cookie was set');
  return String(match).split(';')[0]!;
}
