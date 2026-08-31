/**
 * Creates the tenant and the first admin. Safe to run more than once — it
 * inserts what is missing and leaves what is there alone.
 *
 * Run with: npm run seed
 */
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { hashPassword } from '../auth/password.js';
import { tenants, users } from './schema.js';

process.loadEnvFile('../../.env');

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'prime-market';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@primemarket.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-now';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { casing: 'snake_case' });

  let [tenant] = await db.select().from(tenants).where(eq(tenants.slug, TENANT_SLUG));
  if (!tenant) {
    [tenant] = await db
      .insert(tenants)
      .values({ slug: TENANT_SLUG, name: 'Prime Market' })
      .returning();
    console.log(`tenant created: ${tenant.slug}`);
  }

  const [existing] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
  if (existing) {
    console.log(`admin already exists: ${ADMIN_EMAIL}`);
  } else {
    await db.insert(users).values({
      tenantId: tenant.id,
      email: ADMIN_EMAIL,
      name: 'Owner',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: 'ADMIN',
    });
    console.log(`admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
