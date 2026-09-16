import type { EntityManager } from 'typeorm';

/** All stock writers lock variants in the same order before reading balances. */
export async function lockStock(tx: EntityManager, variantIds: string[]): Promise<void> {
  const ids = [...new Set(variantIds)].sort();
  if (ids.length) {
    await tx.query('SELECT id FROM product_variant WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
  }
}
