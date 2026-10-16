import type { DataSource } from 'typeorm';
import { StockMovement } from '../inventory/stock-movement.entity';
import { ChannelListing, type Channel } from './channel-listing.entity';
import { PRODUCT_CATEGORIES, Product, type ProductCategory } from './product.entity';
import { ProductVariant } from './product-variant.entity';

/**
 * One physical item and every listing that sells it, as linked from the
 * channel exports: noon catalogue, Amazon all-offers report, website export.
 */
export interface LinkedProduct {
  name: string;
  category: ProductCategory | null;
  sellingPrice: string | null;
  /** Units at noon's warehouse — noon's own count. */
  noonStock: number;
  /** Units on our own shelf, as declared on the channel listings. */
  warehouseStock: number;
  listings: Array<{ channel: Channel; externalId: string; partnerSku: string | null; title: string | null; price: string | null }>;
}

export interface ImportReport {
  created: number;
  /** Already in the catalogue: one of its listings is linked to a product. */
  skipped: Array<{ name: string; linkedTo: string }>;
  failed: Array<{ name: string; reason: string }>;
  listings: number;
  units: { warehouse: number; noon: number };
}

const CHANNELS: readonly Channel[] = ['noon', 'amazon', 'easyorders'];
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
export const OPENING_IMPORT = 'opening_import';

/** Everything wrong with the file, before anything is written. */
export function validateLinkedCatalog(products: LinkedProduct[]): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  products.forEach((p, i) => {
    const at = `product ${i + 1} (${p.name || 'no name'})`;
    if (!p.name?.trim()) problems.push(`${at}: no name`);
    if (p.category !== null && !PRODUCT_CATEGORIES.includes(p.category)) problems.push(`${at}: unknown category ${p.category}`);
    if (p.sellingPrice !== null && !MONEY.test(p.sellingPrice)) problems.push(`${at}: selling price ${p.sellingPrice}`);
    for (const [label, n] of [['noon stock', p.noonStock], ['warehouse stock', p.warehouseStock]] as const) {
      if (!Number.isInteger(n) || n < 0) problems.push(`${at}: ${label} ${n}`);
    }
    if (!p.listings?.length) problems.push(`${at}: no listings`);
    for (const l of p.listings ?? []) {
      if (!CHANNELS.includes(l.channel)) problems.push(`${at}: channel ${l.channel}`);
      if (!l.externalId?.trim()) problems.push(`${at}: a ${l.channel} listing has no id`);
      if (l.price !== null && !MONEY.test(l.price)) problems.push(`${at}: listing price ${l.price}`);
      const key = `${l.channel}:${l.externalId}`;
      if (keys.has(key)) problems.push(`${at}: ${key} appears twice in the file`);
      keys.add(key);
    }
  });
  return problems;
}

/**
 * Creates each product with its default variant (no SKU of our own), every
 * channel listing, and its opening stock as counts: noon's units at NOON and
 * the declared shelf units at WAREHOUSE, cost unknown. No ledger entry — an
 * opening count moves no money; the first purchase sets the average cost.
 *
 * One transaction per product, so one bad row never takes the rest down, and
 * a product any of whose listings is already linked is skipped — re-running
 * the same file creates nothing twice. `apply: false` writes nothing.
 */
export async function importLinkedCatalog(
  db: DataSource,
  products: LinkedProduct[],
  { actorId, apply, stockAsOf }: { actorId: string | null; apply: boolean; stockAsOf?: Date },
): Promise<ImportReport> {
  // When the counts were true: the exports' snapshot, not the moment of import —
  // channel sales after it still have to come off, sales before it already did.
  const asOf = stockAsOf ?? new Date();
  const report: ImportReport = { created: 0, skipped: [], failed: [], listings: 0, units: { warehouse: 0, noon: 0 } };
  for (const p of products) {
    try {
      await db.transaction(async (tx) => {
        const [linked] = await tx.query(
          `SELECT pr.name FROM channel_listing l
           JOIN product_variant v ON v.id = l.variant_id JOIN product pr ON pr.id = v.product_id
           WHERE (l.channel, l.external_id) IN (SELECT * FROM unnest($1::text[], $2::text[])) AND l.external_variant_id = ''
           LIMIT 1`,
          [p.listings.map((l) => l.channel), p.listings.map((l) => l.externalId.trim())],
        );
        if (linked) {
          report.skipped.push({ name: p.name, linkedTo: linked.name });
          return;
        }
        report.created++;
        report.listings += p.listings.length;
        report.units.warehouse += p.warehouseStock;
        report.units.noon += p.noonStock;
        if (!apply) return;

        const product = await tx.save(Product, { name: p.name.trim(), category: p.category, discovered: false, active: true });
        const variant = await tx.save(ProductVariant, {
          productId: product.id,
          name: 'Default',
          sku: null,
          attributes: {},
          unitCost: null,
          sellingPrice: p.sellingPrice,
          active: true,
        });
        await tx.insert(
          ChannelListing,
          p.listings.map((l) => ({
            channel: l.channel,
            externalId: l.externalId.trim(),
            externalVariantId: '',
            partnerSku: l.partnerSku,
            title: l.title,
            price: l.price,
            variantId: variant.id,
          })),
        );
        const opening = (location: 'WAREHOUSE' | 'NOON', quantity: number, note: string) =>
          quantity > 0
            ? tx.insert(StockMovement, {
                variantId: variant.id,
                location,
                quantity,
                reason: 'COUNT',
                note,
                unitCost: null,
                sourceType: OPENING_IMPORT,
                createdById: actorId,
                occurredAt: asOf,
              })
            : null;
        await opening('WAREHOUSE', p.warehouseStock, 'opening stock — declared on the channel listings');
        await opening('NOON', p.noonStock, "opening stock — noon's warehouse count");
      });
    } catch (e) {
      report.failed.push({ name: p.name, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}
