import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { FinanceService } from '../finance/finance.service';
import { lockStock } from '../inventory/stock-lock';
import { StockMovement } from '../inventory/stock-movement.entity';
import { stockOpenedAt } from '../inventory/stock-opening';
import { AmazonImport } from './amazon-import.entity';
import { AmazonTransaction } from './amazon-transaction.entity';
import { AmazonRow, parseAmazonReport } from './amazon-report.parser';

export interface AmazonImportResult {
  importId: string;
  alreadyImported: boolean;
  rowsInFile: number;
  rowsInserted: number;
  rowsSkipped: number;
  /** Lines already held whose money Amazon has released since — refreshed, not added. */
  rowsUpdated: number;
  /** Seller SKUs in this file with no matching product yet — need linking. */
  unmappedListings: number;
  periodStart: string | null;
  periodEnd: string | null;
  /** Units the file's orders and refunds took off (or put back on) the shelf. */
  stockMoved?: number;
  /** Units sold before the opening count, which already reflects them — stock left alone. */
  stockBeforeOpening?: number;
}

/** Cairo's calendar day of a moment — the business's day, not UTC's. */
const cairoDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

@Injectable()
export class AmazonImportService {
  private readonly log = new Logger(AmazonImportService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly finance: FinanceService,
  ) {}

  /**
   * Imports an Amazon transaction report. Safe to repeat: the identical file is
   * recognised by its hash, an overlapping report is deduplicated line by line,
   * and a line Amazon has since released is refreshed rather than added again.
   * Products are never created here — an unknown SKU is reported back.
   */
  async import(filename: string, bytes: Buffer): Promise<AmazonImportResult> {
    const fileHash = createHash('sha256').update(bytes).digest('hex');
    const seen = await this.db.getRepository(AmazonImport).findOneBy({ fileHash });
    if (seen) return { ...describe(seen), alreadyImported: true };

    // Parsed before the transaction opens: a malformed file touches nothing.
    const rows = parseAmazonReport(bytes.toString('utf8'));

    return this.db.transaction(async (tx) => {
      const listingBySku = await this.resolveListings(tx, rows);
      const skus = new Set(rows.map((r) => r.sku).filter((s): s is string => !!s));
      const unmapped = [...skus].filter((s) => !listingBySku.has(s)).length;

      const known = await this.knownRows(tx, rows);
      const fresh = rows.filter((r) => !known.has(r.fingerprint));
      let updated = 0;
      for (const r of rows) {
        const was = known.get(r.fingerprint);
        if (!was || (was.status === r.status && was.releaseAt?.getTime() === r.releaseAt?.getTime() && was.settlementId === r.settlementId)) continue;
        await tx.update(AmazonTransaction, { fingerprint: r.fingerprint }, { status: r.status, releaseAt: r.releaseAt, settlementId: r.settlementId });
        updated++;
      }

      const days = rows.map((r) => cairoDay(r.postedAt)).sort();
      const record = await tx.save(AmazonImport, {
        filename,
        fileHash,
        rowsInFile: rows.length,
        rowsInserted: fresh.length,
        rowsSkipped: rows.length - fresh.length,
        rowsUpdated: updated,
        unmappedListings: unmapped,
        periodStart: days[0] ?? null,
        periodEnd: days[days.length - 1] ?? null,
      });
      for (let i = 0; i < fresh.length; i += 500) {
        await tx.insert(
          AmazonTransaction,
          fresh.slice(i, i + 500).map((r) => ({ ...r, importId: record.id, listingId: r.sku ? (listingBySku.get(r.sku)?.listingId ?? null) : null })),
        );
      }
      await this.attributeOrderFees(tx);

      const stock = await this.applyStockMovements(tx, fresh, listingBySku);
      // A transfer is money leaving Amazon for our bank: negative in its report.
      for (const r of fresh) {
        if (r.type === 'Transfer' && Number(r.total) < 0) {
          await this.finance.recordAmazonPayout(tx, (-Number(r.total)).toFixed(2), r.fingerprint, r.postedAt);
        }
      }

      this.log.log(
        `${filename}: ${fresh.length} new, ${rows.length - fresh.length} held already (${updated} refreshed), ${unmapped} unmapped SKUs, ` +
          `${stock.moved} units moved, ${stock.beforeOpening} before the opening count`,
      );
      return { ...describe(record), alreadyImported: false, stockMoved: stock.moved, stockBeforeOpening: stock.beforeOpening };
    });
  }

  /** The product behind each seller SKU in the file. Creates nothing. */
  private async resolveListings(tx: EntityManager, rows: AmazonRow[]) {
    const wanted = [...new Set(rows.map((r) => r.sku).filter((s): s is string => !!s))];
    const out = new Map<string, { listingId: string; variantId: string }>();
    if (!wanted.length) return out;
    const found: Array<{ id: string; variantId: string; sku: string }> = await tx.query(
      `SELECT l.id, l.variant_id AS "variantId", l.external_id AS sku
       FROM channel_listing l
       JOIN product_variant v ON v.id = l.variant_id
       JOIN product p ON p.id = v.product_id
       WHERE l.channel = 'amazon' AND l.external_id = ANY($1::text[]) AND l.external_variant_id = '' AND v.active AND p.active`,
      [wanted],
    );
    for (const l of found) out.set(l.sku, { listingId: l.id, variantId: l.variantId });
    return out;
  }

  private async knownRows(tx: EntityManager, rows: AmazonRow[]) {
    const known = new Map<string, Pick<AmazonTransaction, 'status' | 'releaseAt' | 'settlementId'>>();
    const all = [...new Set(rows.map((r) => r.fingerprint))];
    for (let i = 0; i < all.length; i += 1000) {
      const found = await tx.find(AmazonTransaction, {
        select: { fingerprint: true, status: true, releaseAt: true, settlementId: true },
        where: { fingerprint: In(all.slice(i, i + 1000)) },
      });
      for (const f of found) known.set(f.fingerprint, f);
    }
    return known;
  }

  /**
   * A fee line (Easy Ship charges, a cancellation charge) names its order but
   * no SKU; when that order sold one product, the fee is that product's. Run
   * over every unattributed line, so a fee uploaded before its order is
   * attributed once the order arrives.
   */
  private async attributeOrderFees(tx: EntityManager) {
    await tx.query(
      `UPDATE amazon_transaction f SET listing_id = o.listing_id
       FROM (SELECT order_id, min(listing_id::text)::uuid AS listing_id FROM amazon_transaction
             WHERE type = 'Order' AND order_id IS NOT NULL AND listing_id IS NOT NULL
             GROUP BY order_id HAVING count(DISTINCT listing_id) = 1) o
       WHERE f.listing_id IS NULL AND f.sku IS NULL AND f.type <> 'Transfer' AND f.order_id = o.order_id`,
    );
  }

  /**
   * Orders and refunds move stock by their quantity, at the moment Amazon
   * posted them. Every Amazon order here is shipped by us (Easy Ship), so it
   * leaves our warehouse; a refunded unit comes back to it. Lines posted before
   * a product's opening count are already inside that count and move nothing.
   */
  private async applyStockMovements(tx: EntityManager, fresh: AmazonRow[], listingBySku: Map<string, { variantId: string }>) {
    type StockEvent = { row: AmazonRow; variantId: string; quantity: number; reason: 'SALE' | 'RETURN' };
    const events = fresh.flatMap((r): StockEvent[] => {
      const listing = r.sku ? listingBySku.get(r.sku) : undefined;
      if (!listing || r.quantity <= 0) return [];
      if (r.type === 'Order') return [{ row: r, variantId: listing.variantId, quantity: -r.quantity, reason: 'SALE' }];
      if (r.type === 'Refund') return [{ row: r, variantId: listing.variantId, quantity: r.quantity, reason: 'RETURN' }];
      return [];
    });
    if (!events.length) return { moved: 0, beforeOpening: 0 };

    const variantIds = [...new Set(events.map((e) => e.variantId))];
    await lockStock(tx, variantIds);
    const opened = await stockOpenedAt(tx, variantIds);
    let moved = 0;
    let beforeOpening = 0;
    const movements: Array<Partial<StockMovement>> = [];
    for (const e of events) {
      const at = opened.get(e.variantId);
      if (at && e.row.postedAt < at) {
        beforeOpening += Math.abs(e.quantity);
        continue;
      }
      moved += Math.abs(e.quantity);
      movements.push({
        variantId: e.variantId,
        location: 'WAREHOUSE',
        quantity: e.quantity,
        reason: e.reason,
        sourceType: 'amazon_transaction',
        sourceId: e.row.fingerprint,
        occurredAt: e.row.postedAt,
        note: e.row.orderId,
      });
    }
    if (movements.length) await tx.insert(StockMovement, movements);
    return { moved, beforeOpening };
  }
}

function describe(i: AmazonImport): Omit<AmazonImportResult, 'alreadyImported'> {
  return {
    importId: i.id,
    rowsInFile: i.rowsInFile,
    rowsInserted: i.rowsInserted,
    rowsSkipped: i.rowsSkipped,
    rowsUpdated: i.rowsUpdated,
    unmappedListings: i.unmappedListings,
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
  };
}
