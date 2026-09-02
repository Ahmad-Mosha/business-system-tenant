import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { FinanceService } from '../finance/finance.service';
import { StockMovement, type StockReason } from '../inventory/stock-movement.entity';
import { ChannelListing } from './channel-listing.entity';
import { PRODUCT_CATEGORIES, type ProductCategory } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Product } from './product.entity';

export interface CreateProductInput {
  name: string;
  category?: ProductCategory;
  sku?: string;
  unitCost?: string;
  sellingPrice?: string;
  openingStock?: number;
  /** Channel SKUs to link on creation — same as adding them from the product screen after. */
  listings?: Array<{ channel: string; externalId: string }>;
}

export interface ProductFilters {
  search?: string;
  channel?: string;
  category?: string;
  stock?: string;
}

const MONEY = /^\d+(\.\d{1,2})?$/;

@Injectable()
export class CatalogService {
  private readonly log = new Logger(CatalogService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly finance: FinanceService,
  ) {}

  /**
   * Products with their stock on hand and channel coverage.
   *
   * Stock is aggregated in the same query rather than per row, so the list
   * stays one round trip however many products exist.
   */
  /**
   * Builds the WHERE clause shared by the product list and its summary, so the
   * two can never quietly drift out of agreement — the bug that produced a
   * fan-out-inflated stock figure earlier came from exactly this kind of
   * duplicated-but-diverging query logic.
   */
  private buildProductFilters(f: ProductFilters): { whereSql: string; params: unknown[] } {
    const params: unknown[] = [];
    const bind = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    // Archived products are gone from the working list entirely — there is no
    // "show archived" view yet because nothing has asked for one.
    const whereClauses: string[] = ['p.active'];
    if (f.search) whereClauses.push(`p.name ILIKE ${bind(`%${f.search}%`)}`);
    if (f.category) {
      whereClauses.push(
        f.category.toLowerCase() === 'uncategorised'
          ? `p.category IS NULL`
          : `p.category = ${bind(f.category)}`,
      );
    }
    if (f.channel) {
      whereClauses.push(
        f.channel.toLowerCase() === 'unlisted'
          ? `p.id NOT IN (SELECT v2.product_id FROM channel_listing l2 JOIN product_variant v2 ON v2.id = l2.variant_id)`
          : `p.id IN (SELECT v2.product_id FROM channel_listing l2 JOIN product_variant v2 ON v2.id = l2.variant_id WHERE l2.channel = ${bind(f.channel)})`,
      );
    }
    // Stock filters compare against the aggregate computed in the lateral
    // subquery, so they must be collected before the WHERE clause is built.
    const stockFilters: Record<string, string> = {
      in_stock: 'stock.on_hand > 0',
      low_stock: 'stock.on_hand > 0 AND stock.on_hand <= 5',
      out_of_stock: 'stock.on_hand <= 0',
    };
    if (f.stock && stockFilters[f.stock]) whereClauses.push(stockFilters[f.stock]);

    return { whereSql: `WHERE ${whereClauses.join(' AND ')}`, params };
  }

  /**
   * Products with their stock on hand and channel coverage.
   *
   * Stock is aggregated in the same query rather than per row, so the list
   * stays one round trip however many products exist.
   */
  async listProducts(options?: ProductFilters & { limit?: number; offset?: number }) {
    const { whereSql, params } = this.buildProductFilters(options ?? {});
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const offset = Math.max(options?.offset ?? 0, 0);

    return this.db.query(
      `SELECT p.id, p.name, p.category, p.discovered, p.active,
              stock.variant_count                               AS "variantCount",
              stock.on_hand                                     AS "onHand",
              stock.unit_cost                                   AS "unitCost",
              stock.selling_price                               AS "sellingPrice",
              COALESCE(held.open, 0)::int                       AS "inOrders",
              COALESCE(ch.channels, '{}')                       AS channels,
              count(*) OVER()::int                              AS "totalCount"
       FROM product p
       -- Aggregated separately on purpose. Joining stock_movement and
       -- channel_listing in one statement multiplies every movement by the
       -- number of listings, which silently inflates stock and stock value.
       LEFT JOIN LATERAL (
         SELECT count(DISTINCT v.id)::int          AS variant_count,
                COALESCE(SUM(m.quantity), 0)::int  AS on_hand,
                MIN(v.unit_cost)                   AS unit_cost,
                MIN(v.selling_price)               AS selling_price
         FROM product_variant v
         LEFT JOIN stock_movement m ON m.variant_id = v.id
         WHERE v.product_id = p.id
       ) stock ON TRUE
       -- Units already off on-hand (stock leaves at order creation — there is
       -- no reserved state) but sitting in an order that hasn't been
       -- delivered or reversed yet. Context on "why is on-hand this number" —
       -- and it stops counting once the sale is actually done.
       LEFT JOIN LATERAL (
         SELECT SUM(i.quantity) AS open
         FROM order_item i
         JOIN product_variant v ON v.id = i.variant_id
         JOIN customer_order o ON o.id = i.order_id
         WHERE v.product_id = p.id AND o.status NOT IN ('CANCELLED', 'RETURNED', 'DELIVERED')
       ) held ON TRUE
       LEFT JOIN LATERAL (
         SELECT array_agg(DISTINCT l.channel) AS channels
         FROM channel_listing l
         JOIN product_variant v ON v.id = l.variant_id
         WHERE v.product_id = p.id
       ) ch ON TRUE
       ${whereSql}
       ORDER BY p.name
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
  }

  /**
   * Aggregate totals across every product matching the filters — not just the
   * current page. Shares its WHERE clause with listProducts so the header
   * numbers and the table underneath it always describe the same set.
   */
  async productsSummary(options?: ProductFilters) {
    const { whereSql, params } = this.buildProductFilters(options ?? {});
    const [row] = await this.db.query(
      `SELECT count(*)::int                                              AS products,
              COALESCE(SUM(stock.on_hand), 0)::int                       AS "unitsOnHand",
              COALESCE(SUM(stock.on_hand * COALESCE(stock.unit_cost, 0)), 0) AS "stockValue",
              count(*) FILTER (WHERE stock.unit_cost IS NULL)::int       AS "missingCost",
              COALESCE(SUM(held.open), 0)::int                           AS "unitsInOrders"
       FROM product p
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(m.quantity), 0)::int AS on_hand, MIN(v.unit_cost) AS unit_cost
         FROM product_variant v
         LEFT JOIN stock_movement m ON m.variant_id = v.id
         WHERE v.product_id = p.id
       ) stock ON TRUE
       LEFT JOIN LATERAL (
         SELECT SUM(i.quantity) AS open
         FROM order_item i
         JOIN product_variant v ON v.id = i.variant_id
         JOIN customer_order o ON o.id = i.order_id
         WHERE v.product_id = p.id AND o.status NOT IN ('CANCELLED', 'RETURNED', 'DELIVERED')
       ) held ON TRUE
       ${whereSql}`,
      params,
    );
    return row;
  }

  async getProduct(id: string) {
    const product = await this.db.getRepository(Product).findOne({ where: { id } });
    if (!product) throw new NotFoundException('product not found');

    // Two independent lateral joins, not one double join: stock_movement and
    // order_item both fan out per variant, and summing either across a join
    // of the other would multiply rows and inflate the total.
    const variants = await this.db.query(
      `SELECT v.id, v.name, v.sku, v.attributes, v.unit_cost AS "unitCost",
              v.selling_price AS "sellingPrice", v.active,
              COALESCE(stock.on_hand, 0)::int AS "onHand",
              COALESCE(held.open, 0)::int AS "inOpenOrders"
       FROM product_variant v
       LEFT JOIN LATERAL (
         SELECT SUM(quantity) AS on_hand FROM stock_movement m WHERE m.variant_id = v.id
       ) stock ON TRUE
       LEFT JOIN LATERAL (
         SELECT SUM(i.quantity) AS open
         FROM order_item i
         JOIN customer_order o ON o.id = i.order_id
         WHERE i.variant_id = v.id AND o.status NOT IN ('CANCELLED', 'RETURNED', 'DELIVERED')
       ) held ON TRUE
       WHERE v.product_id = $1
       ORDER BY v.name`,
      [id],
    );

    const listings = await this.db.query(
      `SELECT l.id, l.channel, l.external_id AS "externalId",
              l.external_variant_id AS "externalVariantId",
              l.partner_sku AS "partnerSku", l.title, l.price, l.variant_id AS "variantId"
       FROM channel_listing l
       JOIN product_variant v ON v.id = l.variant_id
       WHERE v.product_id = $1
       ORDER BY l.channel`,
      [id],
    );

    return { ...product, variants, listings };
  }

  /**
   * Creates a product and its default variant together, so the product is
   * immediately sellable, stockable and listable — never an orphan record that
   * has to be reconciled into the model later.
   */
  async createProduct(input: CreateProductInput, userId: string) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    if (input.category && !PRODUCT_CATEGORIES.includes(input.category)) {
      throw new BadRequestException(`category must be one of: ${PRODUCT_CATEGORIES.join(', ')}`);
    }
    for (const [field, value] of [
      ['unitCost', input.unitCost],
      ['sellingPrice', input.sellingPrice],
    ] as const) {
      if (value !== undefined && value !== '' && !MONEY.test(value)) {
        throw new BadRequestException(`${field} must be an amount like 120.50`);
      }
    }
    if (input.openingStock !== undefined) {
      if (!Number.isInteger(input.openingStock)) {
        throw new BadRequestException('opening stock must be a whole number');
      }
      if (input.openingStock < 0) {
        throw new BadRequestException('opening stock cannot be negative');
      }
    }
    const sku = input.sku?.trim();
    if (sku) {
      const clash = await this.db.getRepository(ProductVariant).findOne({ where: { sku } });
      if (clash) throw new BadRequestException(`SKU "${sku}" is already in use`);
    }

    return this.db.transaction(async (tx) => {
      const product = await tx.save(Product, {
        name: input.name.trim(),
        category: input.category ?? null,
        discovered: false,
        active: true,
      });

      const variant = await tx.save(ProductVariant, {
        productId: product.id,
        name: 'Default',
        sku: input.sku?.trim() || null,
        attributes: {},
        unitCost: input.unitCost || null,
        sellingPrice: input.sellingPrice || null,
        active: true,
      });

      if (input.openingStock) {
        await this.addMovement(
          tx,
          variant.id,
          input.openingStock,
          'COUNT',
          userId,
          'opening stock',
          input.unitCost || null,
        );
      }

      // Channel SKUs, when the person entering the product already has them —
      // these are real identifiers they typed, not fabricated ones. A blank
      // field is skipped; a clash rolls the whole product back with the reason.
      for (const l of input.listings ?? []) {
        if (!l?.externalId?.trim()) continue;
        await this.insertListing(tx, variant.id, l.channel, l.externalId);
      }

      return { ...product, variantId: variant.id };
    });
  }

  /** Renames a product or changes its category. Identity (id) never changes. */
  async updateProduct(id: string, patch: { name?: string; category?: ProductCategory | null }) {
    const repo = this.db.getRepository(Product);
    const product = await repo.findOneBy({ id });
    if (!product) throw new NotFoundException('product not found');

    if (patch.category && !PRODUCT_CATEGORIES.includes(patch.category)) {
      throw new BadRequestException(`category must be one of: ${PRODUCT_CATEGORIES.join(', ')}`);
    }
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new BadRequestException('name cannot be empty');
      product.name = patch.name.trim();
    }
    if (patch.category !== undefined) product.category = patch.category;
    return repo.save(product);
  }

  /**
   * Soft delete. A product frequently already has order, stock and listing
   * history by the time anyone wants it gone, and that history must never
   * silently disappear — so this hides it from the working list rather than
   * running a real DELETE. Its variants go inactive with it, which also pulls
   * it out of the manual-order search.
   */
  async archiveProduct(id: string) {
    const product = await this.db.getRepository(Product).findOneBy({ id });
    if (!product) throw new NotFoundException('product not found');

    await this.db.transaction(async (tx) => {
      await tx.update(Product, { id }, { active: false });
      await tx.update(ProductVariant, { productId: id }, { active: false });
    });
  }

  async updateVariant(
    variantId: string,
    patch: { sku?: string | null; unitCost?: string | null; sellingPrice?: string | null; name?: string },
  ) {
    const repo = this.db.getRepository(ProductVariant);
    const variant = await repo.findOneBy({ id: variantId });
    if (!variant) throw new NotFoundException('variant not found');

    for (const [field, value] of [
      ['unitCost', patch.unitCost],
      ['sellingPrice', patch.sellingPrice],
    ] as const) {
      if (value !== undefined && value !== null && value !== '' && !MONEY.test(value)) {
        throw new BadRequestException(`${field} must be an amount like 120.50`);
      }
    }

    if (patch.sku !== undefined) variant.sku = patch.sku?.trim() || null;
    if (patch.name !== undefined) variant.name = patch.name.trim() || 'Default';
    if (patch.unitCost !== undefined) variant.unitCost = patch.unitCost || null;
    if (patch.sellingPrice !== undefined) variant.sellingPrice = patch.sellingPrice || null;
    return repo.save(variant);
  }

  /**
   * The channels a listing can be added for. `social` is deliberately not here
   * — a social sale is keyed as a manual order against a variant directly, it
   * never needs an external identifier to resolve.
   */
  private static readonly LISTING_CHANNELS = ['noon', 'amazon', 'easyorders'] as const;

  /**
   * Links one of our variants to how a sales channel refers to it, so a sale
   * on that channel decrements this stock. Everything is optional per product:
   * a product sold only on social has no listings at all.
   */
  async addListing(
    productId: string,
    input: { channel?: string; externalId?: string; variantId?: string },
  ) {
    const product = await this.db.getRepository(Product).findOne({
      where: { id: productId },
      relations: { variants: true },
    });
    if (!product) throw new NotFoundException('product not found');

    const variantId = await this.resolveListingVariant(product, input.variantId);

    return this.db.transaction((tx) =>
      this.insertListing(tx, variantId, input.channel ?? '', input.externalId ?? ''),
    );
  }

  /**
   * Validates a channel/SKU pair and links it to a variant. The clash check and
   * the insert share one transaction so two adds can't both slip a duplicate
   * past it. Shared by `addListing` and product creation.
   */
  private async insertListing(
    tx: EntityManager,
    variantId: string,
    channelRaw: string,
    externalIdRaw: string,
  ) {
    const channel = channelRaw.trim().toLowerCase();
    if (!(CatalogService.LISTING_CHANNELS as readonly string[]).includes(channel)) {
      throw new BadRequestException(
        `channel must be one of: ${CatalogService.LISTING_CHANNELS.join(', ')}`,
      );
    }
    const externalId = externalIdRaw.trim();
    if (!externalId) throw new BadRequestException('the channel SKU is required');

    const clash = await tx.findOne(ChannelListing, {
      where: { channel: channel as ChannelListing['channel'], externalId, externalVariantId: '' },
    });
    if (clash) {
      throw new BadRequestException(
        `${channel} "${externalId}" is already linked to another product`,
      );
    }

    return tx.save(ChannelListing, {
      channel: channel as ChannelListing['channel'],
      externalId,
      externalVariantId: '',
      // noon's settlement import resolves a row by its Partner SKU, so for noon
      // that column has to carry the same value as externalId.
      partnerSku: channel === 'noon' ? externalId : null,
      variantId,
    });
  }

  /** Correct the identifier on a listing — a mistyped SKU, nothing structural. */
  async updateListing(listingId: string, patch: { externalId?: string }) {
    const repo = this.db.getRepository(ChannelListing);
    const listing = await repo.findOneBy({ id: listingId });
    if (!listing) throw new NotFoundException('listing not found');

    const externalId = (patch.externalId ?? '').trim();
    if (!externalId) throw new BadRequestException('the channel SKU is required');

    if (externalId !== listing.externalId) {
      const clash = await repo.findOne({
        where: {
          channel: listing.channel,
          externalId,
          externalVariantId: listing.externalVariantId,
        },
      });
      if (clash) {
        throw new BadRequestException(
          `${listing.channel} "${externalId}" is already linked to another product`,
        );
      }
    }

    listing.externalId = externalId;
    if (listing.channel === 'noon') listing.partnerSku = externalId;
    return repo.save(listing);
  }

  /**
   * Unlinks a channel from a product. Hard delete on purpose: a listing is a
   * mapping, not history. Any noon transactions resolved through it fall back
   * to unmapped (`listing_id` is `ON DELETE SET NULL`); stock movements already
   * recorded are untouched.
   */
  async removeListing(listingId: string) {
    const result = await this.db.getRepository(ChannelListing).delete({ id: listingId });
    if (!result.affected) throw new NotFoundException('listing not found');
  }

  /** A single-variant product takes the listing automatically; otherwise say which. */
  private async resolveListingVariant(product: Product, variantId?: string): Promise<string> {
    const active = (product.variants ?? []).filter((v) => v.active);
    if (variantId?.trim()) {
      const wanted = variantId.trim();
      if (!active.some((v) => v.id === wanted)) {
        throw new BadRequestException('that variant does not belong to this product');
      }
      return wanted;
    }
    if (active.length === 1) return active[0].id;
    throw new BadRequestException(
      'this product has more than one variant — say which one the listing is for',
    );
  }

  /** Records a stock change. Quantity on hand is always the sum of these. */
  async recordStock(
    variantId: string,
    quantity: number,
    reason: StockReason,
    userId: string,
    note?: string,
  ) {
    if (!Number.isInteger(quantity) || quantity === 0) {
      throw new BadRequestException('quantity must be a non-zero whole number');
    }
    const variant = await this.db.getRepository(ProductVariant).findOneBy({ id: variantId });
    if (!variant) throw new NotFoundException('variant not found');

    return this.db.transaction(async (tx) => {
      const result = await this.addMovement(tx, variantId, quantity, reason, userId, note, variant.unitCost);
      // A purchase converts cash into stock — record the cash side too, same
      // transaction, so the two ledgers can never drift apart. No cost on
      // file means no known cash amount, so it's skipped rather than guessed.
      if (reason === 'PURCHASE' && quantity > 0 && variant.unitCost) {
        const movementId = result.identifiers[0]?.id as string;
        const amount = (quantity * Number(variant.unitCost)).toFixed(2);
        await this.finance.recordPurchase(tx, amount, movementId);
      }
      return result;
    });
  }

  async stockHistory(variantId: string) {
    return this.db.query(
      `SELECT id, quantity, reason, note, unit_cost AS "unitCost",
              occurred_at AS "occurredAt",
              SUM(quantity) OVER (ORDER BY occurred_at, id)::int AS "runningTotal"
       FROM stock_movement
       WHERE variant_id = $1
       ORDER BY occurred_at DESC, id DESC
       LIMIT 200`,
      [variantId],
    );
  }

  private addMovement(
    tx: EntityManager,
    variantId: string,
    quantity: number,
    reason: StockReason,
    userId: string | null,
    note?: string | null,
    unitCost?: string | null,
  ) {
    return tx.insert(StockMovement, {
      variantId,
      quantity,
      reason,
      note: note ?? null,
      unitCost: unitCost ?? null,
      createdById: userId,
      occurredAt: new Date(),
    });
  }

  /**
   * One-time seed from a reviewed Mega export: creates a product + default
   * variant + opening-stock movement per row. Safe to re-run — an exact name
   * match is skipped rather than duplicated, since Mega gives no reliable id
   * to key off (see docs/decisions).
   */
  async importReviewedProducts(
    rows: Array<{ name: string; category: ProductCategory; quantity: number; unitCost: string | null }>,
    userId: string,
  ) {
    let created = 0;
    let skipped = 0;
    const failed: Array<{ name: string; reason: string }> = [];

    for (const row of rows) {
      const name = row.name.trim();
      if (!name) continue;
      try {
        const exists = await this.db.getRepository(Product).findOneBy({ name });
        if (exists) {
          skipped++;
          continue;
        }
        await this.createProduct(
          {
            name,
            category: row.category,
            // The unit_cost column is numeric(14,2); round explicitly here
            // rather than let Postgres do it silently on insert.
            unitCost: row.unitCost ? Number(row.unitCost).toFixed(2) : undefined,
            openingStock: row.quantity || undefined,
          },
          userId,
        );
        created++;
      } catch (e) {
        // One bad row must not take the other 134 down with it.
        failed.push({ name, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    this.log.log(
      `mega import: ${created} created, ${skipped} skipped, ${failed.length} failed`,
    );
    return { created, skipped, failed };
  }

  /** Variants an order line can be attached to, for the manual order form. */
  searchVariants(term: string) {
    return this.db.query(
      `SELECT v.id, v.sku, v.selling_price AS "sellingPrice", v.unit_cost AS "unitCost",
              CASE WHEN v.name = 'Default' THEN p.name ELSE p.name || ' — ' || v.name END AS label,
              COALESCE((SELECT SUM(quantity) FROM stock_movement m WHERE m.variant_id = v.id), 0)::int AS "onHand"
       FROM product_variant v
       JOIN product p ON p.id = v.product_id
       WHERE v.active AND (p.name ILIKE $1 OR v.sku ILIKE $1)
       ORDER BY p.name
       LIMIT 20`,
      [`%${term}%`],
    );
  }

  /**
   * Refreshes title/price on every Easy Orders listing we already have mapped
   * to a product. Creates nothing: a live Easy Orders product with no
   * matching listing is reported as unmatched rather than turned into a stub
   * — Easy Orders can only sell what already exists in our catalogue.
   */
  async syncEasyOrders(apiKey: string) {
    const res = await fetch('https://api.easy-orders.net/api/v1/external-apps/products', {
      headers: { 'Api-Key': apiKey },
    });
    if (!res.ok) throw new BadRequestException(`Easy Orders returned ${res.status}`);

    const products = (await res.json()) as Array<{
      id: string;
      name?: string;
      price?: number;
      slug?: string;
    }>;

    const existing = await this.db.getRepository(ChannelListing).find({
      where: { channel: 'easyorders', externalVariantId: '' },
    });
    const byExternalId = new Map(existing.map((l) => [l.externalId, l]));

    let updated = 0;
    const unmatched: Array<{ id: string; name: string }> = [];

    for (const remote of products) {
      if (!remote?.id) continue;
      const listing = byExternalId.get(remote.id);
      if (!listing) {
        unmatched.push({ id: remote.id, name: remote.name?.trim() || remote.slug || remote.id });
        continue;
      }
      listing.title = remote.name?.trim() || listing.title;
      listing.price = remote.price != null ? String(remote.price) : listing.price;
      await this.db.getRepository(ChannelListing).save(listing);
      updated++;
    }

    this.log.log(
      `easyorders catalogue sync: ${updated} updated, ${unmatched.length} unmatched`,
    );
    return { fetched: products.length, updated, unmatched };
  }
}
