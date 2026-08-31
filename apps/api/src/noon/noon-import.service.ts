import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { ChannelListing } from '../catalog/channel-listing.entity';
import { StockMovement } from '../inventory/stock-movement.entity';
import { NoonImport } from './noon-import.entity';
import { NoonTransaction } from './noon-transaction.entity';
import { NoonRow, parseNoonReport } from './noon-report.parser';

export interface ImportResult {
  importId: string;
  alreadyImported: boolean;
  rowsInFile: number;
  rowsInserted: number;
  rowsSkipped: number;
  /** Partner SKUs in this file with no matching product yet — need mapping. */
  unmappedListings: number;
  periodStart: string | null;
  periodEnd: string | null;
}

@Injectable()
export class NoonImportService {
  private readonly log = new Logger(NoonImportService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Import a noon settlement export. Safe to call repeatedly: the same file is
   * recognised by its hash, and an overlapping export is deduplicated row by
   * row, so only genuinely new lines are stored.
   *
   * Products are never created here. noon can only sell what already exists in
   * our own catalogue (Mega today); a partner SKU with no matching listing
   * stays unmapped and is reported back rather than fabricated into a stub.
   */
  async import(filename: string, bytes: Buffer): Promise<ImportResult> {
    const fileHash = createHash('sha256').update(bytes).digest('hex');

    const seen = await this.db.getRepository(NoonImport).findOneBy({ fileHash });
    if (seen) {
      this.log.log(`${filename}: identical file already imported (${seen.id})`);
      return { ...this.describe(seen), alreadyImported: true };
    }

    // Parsing happens before the transaction opens: a malformed file should
    // fail without having touched the database at all.
    const rows = parseNoonReport(bytes.toString('utf8'));

    return this.db.transaction(async (tx) => {
      const listingBySku = await this.resolveListings(tx, rows);
      const skusInFile = new Set(rows.map((r) => r.partnerSku).filter((s): s is string => !!s));
      const unmapped = [...skusInFile].filter((sku) => !listingBySku.has(sku)).length;

      const fresh = await this.rejectKnownRows(tx, rows);
      const dates = rows.map((r) => r.transactionDate).filter((d): d is string => !!d).sort();

      // The import row is written first so every transaction can reference it.
      // The surrounding transaction means a later failure rolls back both.
      const record = await tx.save(NoonImport, {
        filename,
        fileHash,
        rowsInFile: rows.length,
        rowsInserted: fresh.length,
        rowsSkipped: rows.length - fresh.length,
        unmappedListings: unmapped,
        periodStart: dates[0] ?? null,
        periodEnd: dates[dates.length - 1] ?? null,
      });

      // Chunked: one statement per 500 rows keeps us inside Postgres' bind
      // parameter ceiling on a wide table.
      for (let i = 0; i < fresh.length; i += 500) {
        await tx.insert(
          NoonTransaction,
          fresh.slice(i, i + 500).map((r) => ({
            ...r,
            importId: record.id,
            listingId: r.partnerSku ? (listingBySku.get(r.partnerSku)?.listingId ?? null) : null,
          })),
        );
      }

      await this.applyStockMovements(tx, fresh, listingBySku);

      this.log.log(
        `${filename}: ${fresh.length} new, ${rows.length - fresh.length} skipped, ${unmapped} unmapped`,
      );
      return { ...this.describe(record), alreadyImported: false };
    });
  }

  /** Look up an existing listing for every partner SKU in the file. Creates nothing. */
  private async resolveListings(
    tx: EntityManager,
    rows: NoonRow[],
  ): Promise<Map<string, { listingId: string; variantId: string }>> {
    const wanted = new Set(rows.map((r) => r.partnerSku).filter((s): s is string => !!s));
    if (!wanted.size) return new Map();

    const existing = await tx.find(ChannelListing, {
      where: { channel: 'noon', partnerSku: In([...wanted]) },
    });

    const out = new Map<string, { listingId: string; variantId: string }>();
    for (const l of existing) {
      if (l.partnerSku) out.set(l.partnerSku, { listingId: l.id, variantId: l.variantId });
    }
    return out;
  }

  /**
   * One stock movement per unit sold or returned, for rows newly inserted this
   * import only. Historical rows already imported before this feature existed
   * are deliberately not backfilled: whatever physical stock count is entered
   * as the opening baseline already nets out sales that happened before it was
   * taken, so replaying old rows on top would double-count them.
   *
   * Evidence-based, not a guess: `order` rows are one unit each (no quantity
   * column exists — see docs/evidence). `order_update` rows are mostly fee
   * adjustments, not returns; only the ones with negative net proceeds reverse
   * real value, so only those move stock back in.
   */
  private async applyStockMovements(
    tx: EntityManager,
    fresh: NoonRow[],
    listingBySku: Map<string, { listingId: string; variantId: string }>,
  ) {
    const movements: Array<Partial<StockMovement>> = [];
    for (const r of fresh) {
      if (!r.partnerSku) continue;
      const listing = listingBySku.get(r.partnerSku);
      if (!listing) continue; // unmapped: no product to move stock on

      if (r.transactionType === 'order' && r.itemNr) {
        movements.push({
          variantId: listing.variantId,
          quantity: -1,
          reason: 'SALE',
          sourceType: 'noon_transaction',
          sourceId: r.fingerprint,
          occurredAt: r.transactionDate ? new Date(r.transactionDate) : new Date(),
        });
      } else if (r.transactionType === 'order_update' && Number(r.netProceeds) < 0) {
        movements.push({
          variantId: listing.variantId,
          quantity: 1,
          reason: 'RETURN',
          sourceType: 'noon_transaction',
          sourceId: r.fingerprint,
          occurredAt: r.transactionDate ? new Date(r.transactionDate) : new Date(),
        });
      }
    }
    if (movements.length) await tx.insert(StockMovement, movements);
  }

  /** Drop rows already stored from an earlier overlapping export. */
  private async rejectKnownRows(tx: EntityManager, rows: NoonRow[]): Promise<NoonRow[]> {
    const unique = new Map(rows.map((r) => [r.fingerprint, r]));

    const known = new Set<string>();
    const all = [...unique.keys()];
    // Chunked to keep the IN list well inside Postgres' parameter limit.
    for (let i = 0; i < all.length; i += 1000) {
      const found = await tx.find(NoonTransaction, {
        select: { fingerprint: true },
        where: { fingerprint: In(all.slice(i, i + 1000)) },
      });
      for (const f of found) known.add(f.fingerprint);
    }
    return [...unique.values()].filter((r) => !known.has(r.fingerprint));
  }

  private describe(i: NoonImport): Omit<ImportResult, 'alreadyImported'> {
    return {
      importId: i.id,
      rowsInFile: i.rowsInFile,
      rowsInserted: i.rowsInserted,
      rowsSkipped: i.rowsSkipped,
      unmappedListings: i.unmappedListings,
      periodStart: i.periodStart,
      periodEnd: i.periodEnd,
    };
  }
}
