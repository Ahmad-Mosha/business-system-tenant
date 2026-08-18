import { PERMISSIONS } from '@app/contracts';
import { hash, Algorithm } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { z } from 'zod';
import { loadDotEnv } from '../config/load-dotenv.js';
import { newId } from '../shared/ids.js';

loadDotEnv();
import { createDatabase } from './db.module.js';
import * as schema from './schema.js';

/**
 * Creates the structural rows the application cannot run without - the organization,
 * the permission catalogue, and the two roles - plus the first admin account.
 *
 * Idempotent: safe to run against an existing database. Never prints or stores a
 * plaintext password.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SEED_ORG_NAME: z.string().default('Sazine'),
  SEED_ORG_SLUG: z.string().default('sazine'),
  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_PASSWORD: z.string().min(12, 'Use at least 12 characters'),
  SEED_ADMIN_NAME: z.string().default('Administrator'),
  // Optional second account, so moderator scoping can be exercised before the
  // user-management screens exist.
  SEED_MODERATOR_EMAIL: z.string().email().optional(),
  SEED_MODERATOR_PASSWORD: z.string().min(12).optional(),
  SEED_MODERATOR_NAME: z.string().default('Moderator'),
});

const PERMISSION_CATALOGUE = [
  { code: PERMISSIONS.ORDER_READ, description: 'View orders' },
  { code: PERMISSIONS.ORDER_CREATE, description: 'Create a manual order' },
  { code: PERMISSIONS.ORDER_ASSIGN, description: 'Assign orders to a moderator' },
  { code: PERMISSIONS.ORDER_UPDATE_STATUS, description: 'Move an order through its lifecycle' },
  { code: PERMISSIONS.CATALOG_READ, description: 'View products and variants' },
  { code: PERMISSIONS.CATALOG_WRITE, description: 'Create and edit catalog entries' },
  { code: PERMISSIONS.USER_READ, description: 'View team members' },
];

const ROLES = [
  {
    code: 'ADMIN',
    name: 'Admin',
    grants: [
      { permission: PERMISSIONS.ORDER_READ, scope: 'ALL' as const },
      { permission: PERMISSIONS.ORDER_CREATE, scope: 'ALL' as const },
      { permission: PERMISSIONS.ORDER_ASSIGN, scope: 'ALL' as const },
      { permission: PERMISSIONS.ORDER_UPDATE_STATUS, scope: 'ALL' as const },
      { permission: PERMISSIONS.CATALOG_READ, scope: 'ALL' as const },
      { permission: PERMISSIONS.CATALOG_WRITE, scope: 'ALL' as const },
      { permission: PERMISSIONS.USER_READ, scope: 'ALL' as const },
    ],
  },
  {
    // A moderator works their own orders and needs the catalog to read them,
    // but cannot assign work or change the catalog.
    code: 'MODERATOR',
    name: 'Moderator',
    grants: [
      { permission: PERMISSIONS.ORDER_READ, scope: 'ASSIGNED' as const },
      // Moderators take orders from social channels themselves.
      { permission: PERMISSIONS.ORDER_CREATE, scope: 'ASSIGNED' as const },
      { permission: PERMISSIONS.ORDER_UPDATE_STATUS, scope: 'ASSIGNED' as const },
      { permission: PERMISSIONS.CATALOG_READ, scope: 'ALL' as const },
    ],
  },
];

async function main() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Seed configuration is incomplete:\n${problems}`);
  }
  const env = parsed.data;

  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = createDatabase(client);

  try {
    const organizationId = await upsertOrganization(db, env.SEED_ORG_SLUG, env.SEED_ORG_NAME);

    for (const permission of PERMISSION_CATALOGUE) {
      await db
        .insert(schema.permissions)
        .values(permission)
        .onConflictDoUpdate({
          target: schema.permissions.code,
          set: { description: permission.description },
        });
    }

    const roleIds = new Map<string, string>();
    for (const role of ROLES) {
      const roleId = await upsertRole(db, organizationId, role.code, role.name);
      roleIds.set(role.code, roleId);
      for (const grant of role.grants) {
        await db
          .insert(schema.rolePermissions)
          .values({ roleId, permissionCode: grant.permission, scope: grant.scope })
          .onConflictDoUpdate({
            target: [schema.rolePermissions.roleId, schema.rolePermissions.permissionCode],
            set: { scope: grant.scope },
          });
      }
    }

    await upsertUser(db, {
      organizationId,
      email: env.SEED_ADMIN_EMAIL,
      name: env.SEED_ADMIN_NAME,
      password: env.SEED_ADMIN_PASSWORD,
      roleId: roleIds.get('ADMIN')!,
    });
    console.log(`Admin ready: ${env.SEED_ADMIN_EMAIL.toLowerCase()}`);

    if (env.SEED_MODERATOR_EMAIL && env.SEED_MODERATOR_PASSWORD) {
      await upsertUser(db, {
        organizationId,
        email: env.SEED_MODERATOR_EMAIL,
        name: env.SEED_MODERATOR_NAME,
        password: env.SEED_MODERATOR_PASSWORD,
        roleId: roleIds.get('MODERATOR')!,
      });
      console.log(`Moderator ready: ${env.SEED_MODERATOR_EMAIL.toLowerCase()}`);
    }

    console.log('Seed complete.');
  } finally {
    await client.end();
  }
}

type Db = ReturnType<typeof createDatabase>;

async function upsertOrganization(db: Db, slug: string, name: string): Promise<string> {
  const [existing] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, slug))
    .limit(1);
  if (existing) return existing.id;

  const id = newId();
  await db.insert(schema.organizations).values({ id, slug, name });
  return id;
}

async function upsertRole(
  db: Db,
  organizationId: string,
  code: string,
  name: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.code, code))
    .limit(1);
  if (existing) return existing.id;

  const id = newId();
  await db.insert(schema.roles).values({ id, organizationId, code, name });
  return id;
}

async function upsertUser(
  db: Db,
  input: {
    organizationId: string;
    email: string;
    name: string;
    password: string;
    roleId: string;
  },
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hash(input.password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  const userId = existing?.id ?? newId();
  if (existing) {
    await db
      .update(schema.users)
      .set({ passwordHash, name: input.name, status: 'ACTIVE', updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  } else {
    await db.insert(schema.users).values({
      id: userId,
      organizationId: input.organizationId,
      email,
      name: input.name,
      passwordHash,
    });
  }

  await db
    .insert(schema.userRoles)
    .values({ userId, roleId: input.roleId })
    .onConflictDoNothing();
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
