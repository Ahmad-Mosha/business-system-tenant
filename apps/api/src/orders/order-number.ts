import type { EntityManager } from 'typeorm';

/** One database-owned allocator shared by manual and integrated order paths. */
export async function nextOrderNumber(tx: EntityManager): Promise<string> {
  const [{ nextval }] = await tx.query("SELECT nextval('order_number_seq')");
  return `PM-${nextval}`;
}
