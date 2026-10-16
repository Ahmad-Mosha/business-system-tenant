import type { DataSource, EntityManager } from 'typeorm';
import { OPENING_IMPORT } from '../catalog/linked-catalog-import';

/**
 * The Cairo day each product's stock was counted from the catalogue snapshot
 * (a product sold out at the snapshot has a zero count row). A record dated
 * before it is already inside that count, so it moves no stock. A product
 * added by hand afterwards was never counted: null, every record moves it.
 */
export async function stockOpenedOn(tx: DataSource | EntityManager, variantIds: string[]): Promise<Map<string, string | null>> {
  const rows: Array<{ id: string; opened: string | null }> = await tx.query(
    `SELECT v.id, (SELECT (min(m.occurred_at) AT TIME ZONE 'Africa/Cairo')::date::text FROM stock_movement m
                   WHERE m.variant_id = v.id AND m.source_type = $2) AS opened
     FROM product_variant v WHERE v.id = ANY($1::uuid[])`,
    [variantIds, OPENING_IMPORT],
  );
  return new Map(rows.map((r) => [r.id, r.opened]));
}

/** The moment of each product's opening count, for records that carry a time (Amazon's do). */
export async function stockOpenedAt(tx: DataSource | EntityManager, variantIds: string[]): Promise<Map<string, Date | null>> {
  const rows: Array<{ id: string; opened: Date | null }> = await tx.query(
    `SELECT v.id, (SELECT min(m.occurred_at) FROM stock_movement m WHERE m.variant_id = v.id AND m.source_type = $2) AS opened
     FROM product_variant v WHERE v.id = ANY($1::uuid[])`,
    [variantIds, OPENING_IMPORT],
  );
  return new Map(rows.map((r) => [r.id, r.opened]));
}

/** True when a record dated `on` (YYYY-MM-DD) comes before this product's opening count. */
export const beforeOpening = (opened: Map<string, string | null>, variantId: string, on: string | null) => {
  const day = opened.get(variantId);
  return !!day && !!on && on < day;
};

/** Whether a record wrote any stock movement. */
export async function movedStock(tx: DataSource | EntityManager, sourceType: string, sourceId: string) {
  const [{ moved }] = await tx.query(
    'SELECT EXISTS (SELECT 1 FROM stock_movement WHERE source_type = $1 AND source_id = $2) AS moved',
    [sourceType, sourceId],
  );
  return moved as boolean;
}
