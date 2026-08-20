import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { ChannelListing } from '../catalog/channel-listing.entity';
import { ProductVariant } from '../catalog/product-variant.entity';
import { Product } from '../catalog/product.entity';
import { NoonImport } from './noon-import.entity';
import { NoonTransaction } from './noon-transaction.entity';
import { NoonRow, parseNoonReport } from './noon-report.parser';

export interface ImportResult {
  importId: string;
  alreadyImported: boolean;
  rowsInFile: number;
  rowsInserted: number;
  rowsSkipped: number;
  productsDiscovered: number;
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
      const discovered = [...listingBySku.values()].filter((l) => l.created).length;

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
        productsDiscovered: discovered,
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
            listingId: r.partnerSku ? (listingBySku.get(r.partnerSku)?.id ?? null) : null,
          })),
        );
      }

      this.log.log(
        `${filename}: ${fresh.length} new, ${rows.length - fresh.length} skipped, ${discovered} products discovered`,
      );
      return { ...this.describe(record), alreadyImported: false };
    });
  }

  /**
   * Map every partner SKU in the file to a listing, creating a stub Product for
   * any we have never seen. This is what lets a report be imported before the
   * catalogue exists — the catalogue falls out of the data.
   */
  private async resolveListings(
    tx: EntityManager,
    rows: NoonRow[],
  ): Promise<Map<string, { id: string; created: boolean }>> {
    const wanted = new Map<string, NoonRow>();
    for (const r of rows) if (r.partnerSku) wanted.set(r.partnerSku, r);
    if (!wanted.size) return new Map();

    const existing = await tx.find(ChannelListing, {
      where: { channel: 'noon', partnerSku: In([...wanted.keys()]) },
    });

    const out = new Map<string, { id: string; created: boolean }>();
    for (const l of existing) if (l.partnerSku) out.set(l.partnerSku, { id: l.id, created: false });

    for (const [partnerSku, row] of wanted) {
      if (out.has(partnerSku)) continue;

      const product = await tx.save(Product, {
        name: row.title || partnerSku,
        discovered: true,
        category: null,
      });
      // A discovered product still gets its default variant, so stock and
      // orders can attach to it without a later migration.
      const variant = await tx.save(ProductVariant, {
        productId: product.id,
        name: 'Default',
        attributes: {},
      });
      const listing = await tx.save(ChannelListing, {
        channel: 'noon' as const,
        externalId: row.noonSku ?? partnerSku,
        externalVariantId: '',
        partnerSku,
        title: row.title || null,
        variantId: variant.id,
      });
      out.set(partnerSku, { id: listing.id, created: true });
    }
    return out;
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
      productsDiscovered: i.productsDiscovered,
      periodStart: i.periodStart,
      periodEnd: i.periodEnd,
    };
  }
}
