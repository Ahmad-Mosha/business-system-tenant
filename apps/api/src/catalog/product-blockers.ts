import type { EntityManager } from 'typeorm';
import type { Blocker, Reason } from '../problem';

const LIMIT = 5;

/**
 * Everything standing in the way of deleting or archiving a product — the one
 * place these rules live, read by the product screen (to say so before anyone
 * clicks) and by the actions themselves (which refuse with the same reasons).
 *
 * Delete: only a product never traded — no order, purchase or sales invoice,
 * channel link, or stock bought, sold or returned. That restriction is
 * permanent; archiving is the way out.
 * Archive: allowed once nothing live depends on it — no stock left, no open
 * order, no channel link, no draft invoice. Each of those can be resolved.
 */
export async function productBlockers(tx: EntityManager, productId: string): Promise<{ delete: Reason[]; archive: Reason[] }> {
  const variantsOf = `(SELECT id FROM product_variant WHERE product_id = $1)`;
  const [orders, openOrders, purchases, sales, listings, legacy, stock] = await Promise.all([
    list(tx, `SELECT DISTINCT o.id, o.order_number AS label, o.placed_at AS date, o.status AS detail
              FROM order_item i JOIN customer_order o ON o.id = i.order_id
              WHERE i.variant_id IN ${variantsOf} ORDER BY date DESC`, productId),
    list(tx, `SELECT o.id, o.order_number AS label, o.placed_at AS date, o.status AS detail, SUM(i.quantity)::int AS count
              FROM order_item i JOIN customer_order o ON o.id = i.order_id
              WHERE i.variant_id IN ${variantsOf} AND o.status NOT IN ('CANCELLED', 'RETURNED', 'DELIVERED')
              GROUP BY o.id ORDER BY date DESC`, productId),
    list(tx, `SELECT DISTINCT p.id, p.invoice_no AS label, p.invoice_date::text AS date, p.status AS detail
              FROM purchase_invoice_line l JOIN purchase_invoice p ON p.id = l.invoice_id
              WHERE l.variant_id IN ${variantsOf} ORDER BY date DESC`, productId),
    list(tx, `SELECT DISTINCT s.id, s.invoice_number AS label, s.invoice_date::text AS date, s.status AS detail
              FROM sales_invoice_line l JOIN sales_invoice s ON s.id = l.invoice_id
              WHERE l.variant_id IN ${variantsOf} ORDER BY date DESC`, productId),
    list(tx, `SELECT l.id, l.external_id AS label, l.channel AS detail
              FROM channel_listing l WHERE l.variant_id IN ${variantsOf} ORDER BY l.channel`, productId),
    tx.query(
      `SELECT count(*)::int AS n FROM stock_movement m
       WHERE m.variant_id IN ${variantsOf} AND m.reason IN ('PURCHASE', 'SALE', 'RETURN')
         AND COALESCE(m.source_type, '') NOT IN ('purchase_invoice', 'order', 'sales_invoice')`,
      [productId],
    ),
    tx.query(
      `SELECT m.location AS detail, SUM(m.quantity)::int AS count FROM stock_movement m
       WHERE m.variant_id IN ${variantsOf} GROUP BY m.location HAVING SUM(m.quantity) <> 0 ORDER BY m.location`,
      [productId],
    ),
  ]);

  const reason = (code: string, rows: Row[], kind: Blocker['kind'], parentId?: string): Reason[] =>
    rows.length
      ? [{
          code,
          params: { count: rows.length },
          blockers: rows.slice(0, LIMIT).map((r) => ({
            kind,
            id: parentId ? undefined : r.id,
            parentId,
            label: r.label ?? undefined,
            date: r.date ? String(r.date) : undefined,
            detail: r.detail ?? undefined,
            count: r.count ?? undefined,
          })),
        }]
      : [];
  const draftPurchases = purchases.filter((p) => p.detail === 'DRAFT');
  const draftSales = sales.filter((s) => s.detail === 'DRAFT');
  const units = (stock as Row[]).reduce((n, s) => n + Number(s.count), 0);

  return {
    delete: [
      ...reason('product.usedInOrders', orders, 'order'),
      ...reason('product.usedInPurchases', purchases, 'purchase_invoice'),
      ...reason('product.usedInSales', sales, 'sales_invoice'),
      ...reason('product.usedInChannels', listings, 'listing', productId),
      ...(legacy[0].n ? [{ code: 'product.stockTraded', params: { count: legacy[0].n } }] : []),
    ],
    archive: [
      ...((stock as Row[]).length
        ? [{
            code: 'product.archiveStock',
            params: { count: units },
            blockers: (stock as Row[]).map((s) => ({ kind: 'stock' as const, parentId: productId, detail: s.detail ?? undefined, count: Number(s.count) })),
          }]
        : []),
      ...reason('product.archiveOrders', openOrders, 'order'),
      ...reason('product.archiveListings', listings, 'listing', productId),
      ...reason('product.archiveDrafts', draftPurchases, 'purchase_invoice'),
      ...reason('product.archiveSalesDrafts', draftSales, 'sales_invoice'),
    ],
  };
}

interface Row {
  id: string;
  label: string | null;
  date?: string | Date | null;
  detail?: string | null;
  count?: number | null;
}

function list(tx: EntityManager, sql: string, productId: string): Promise<Row[]> {
  return tx.query(sql, [productId]);
}

/**
 * The archived products among some variants — named and linked, so "choose
 * active products" becomes "Laptop stand is archived: restore it or remove its
 * line". Empty when every one is active.
 */
export async function archivedProducts(tx: EntityManager, variantIds: string[]): Promise<Blocker[]> {
  const rows: Array<{ id: string; label: string }> = await tx.query(
    `SELECT DISTINCT p.id, p.name AS label FROM product_variant v JOIN product p ON p.id = v.product_id
     WHERE v.id = ANY($1::uuid[]) AND NOT (v.active AND p.active)`,
    [variantIds],
  );
  return rows.map((r) => ({ kind: 'product' as const, id: r.id, label: r.label }));
}
