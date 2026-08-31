/**
 * Loads the real catalogue extracted from the legacy Mega system — 135
 * products, Arabic names, four categories.
 *
 * What this seed does NOT load is the quantities and unit costs in the same
 * file. Those are an opening *balance*, and a balance belongs to the stock
 * ledger with a date and a reason attached, not to the product record. They
 * arrive with the opening count.
 *
 * The extraction agrees with Mega's own printed total to 99.4% on units and
 * 99.8% on value. That is good enough to confirm nothing was wholly missed and
 * not good enough to call any single row audited — a physical count is what
 * makes these numbers real.
 *
 * Safe to run more than once: a product already present by name is left alone.
 *
 * Run with: pnpm seed:catalogue
 */
import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { CATEGORIES, type Category, products, tenants, variants } from './schema.js';

process.loadEnvFile('../../.env');

const SOURCE = '../../docs/data/mega-products.json';

interface MegaRow {
  row: number;
  name: string;
  category: string;
  quantity: number;
  unitCost: string | null;
}

async function main() {
  const rows = JSON.parse(await readFile(SOURCE, 'utf8')) as MegaRow[];

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { casing: 'snake_case' });

  const slug = process.env.TENANT_SLUG ?? 'prime-market';
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
  if (!tenant) throw new Error(`no tenant "${slug}" — run: pnpm seed`);

  const existing = new Set(
    (
      await db
        .select({ name: products.name })
        .from(products)
        .where(eq(products.tenantId, tenant.id))
    ).map((p) => p.name),
  );

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;

    if (existing.has(name)) {
      skipped++;
      continue;
    }

    if (!(CATEGORIES as readonly string[]).includes(row.category)) {
      throw new Error(`row ${row.row}: unknown category "${row.category}"`);
    }

    await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({ tenantId: tenant.id, name, category: row.category as Category })
        .returning();

      // No sizes or colours came out of Mega. Every product still gets one
      // variant so that stock and orders have exactly one thing to point at.
      await tx.insert(variants).values({ tenantId: tenant.id, productId: product.id });
    });

    existing.add(name);
    created++;
  }

  const counts = await db
    .select({ category: products.category })
    .from(products)
    .where(eq(products.tenantId, tenant.id));

  const byCategory = counts.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`created ${created}, already present ${skipped}`);
  console.log('by category:', byCategory);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
