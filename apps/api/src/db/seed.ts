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
const MODERATOR_EMAIL = process.env.SEED_MODERATOR_EMAIL ?? 'moderator@primemarket.local';
const MODERATOR_PASSWORD = process.env.SEED_MODERATOR_PASSWORD ?? 'moderator-pass';

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

  // Both roles, so role separation can be checked by signing in rather than
  // by reading the code.
  for (const person of [
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Owner', role: 'ADMIN' as const },
    {
      email: MODERATOR_EMAIL,
      password: MODERATOR_PASSWORD,
      name: 'Moderator',
      role: 'MODERATOR' as const,
    },
  ]) {
    const [existing] = await db.select().from(users).where(eq(users.email, person.email));
    if (existing) {
      console.log(`${person.role.toLowerCase()} already exists: ${person.email}`);
      continue;
    }
    await db.insert(users).values({
      tenantId: tenant.id,
      email: person.email,
      name: person.name,
      passwordHash: await hashPassword(person.password),
      role: person.role,
    });
    console.log(`${person.role.toLowerCase()} created: ${person.email} / ${person.password}`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
