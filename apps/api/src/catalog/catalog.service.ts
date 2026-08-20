import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { StockMovement, type StockReason } from '../inventory/stock-movement.entity';
import { ChannelListing } from './channel-listing.entity';
import { ProductVariant } from './product-variant.entity';
import { Product } from './product.entity';

export interface CreateProductInput {
  name: string;
  category?: string;
  sku?: string;
  unitCost?: string;
  sellingPrice?: string;
  openingStock?: number;
}

const MONEY = /^\d+(\.\d{1,2})?$/;

@Injectable()
export class CatalogService {
  private readonly log = new Logger(CatalogService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Products with their stock on hand and channel coverage.
   *
   * Stock is aggregated in the same query rather than per row, so the list
   * stays one round trip however many products exist.
   */
  async listProducts(search?: string, limit = 100, offset = 0) {
    const params: unknown[] = [];
    const bind = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where = search ? `WHERE p.name ILIKE ${bind(`%${search}%`)}` : '';

    return this.db.query(
      `SELECT p.id, p.name, p.category, p.discovered, p.active,
              count(DISTINCT v.id)::int                         AS "variantCount",
              COALESCE(SUM(m.quantity), 0)::int                 AS "onHand",
              MIN(v.unit_cost)                                  AS "unitCost",
              MIN(v.selling_price)                              AS "sellingPrice",
              COALESCE(
                array_agg(DISTINCT l.channel) FILTER (WHERE l.channel IS NOT NULL),
                '{}'
              )                                                 AS channels,
              count(*) OVER()::int                              AS "totalCount"
       FROM product p
       LEFT JOIN product_variant v ON v.product_id = p.id
       LEFT JOIN stock_movement  m ON m.variant_id = v.id
       LEFT JOIN channel_listing l ON l.variant_id = v.id
       ${where}
       GROUP BY p.id
       ORDER BY p.name
       LIMIT ${Math.min(Math.max(limit, 1), 200)} OFFSET ${Math.max(offset, 0)}`,
      params,
    );
  }

  async getProduct(id: string) {
    const product = await this.db.getRepository(Product).findOne({ where: { id } });
    if (!product) throw new NotFoundException('product not found');

    const variants = await this.db.query(
      `SELECT v.id, v.name, v.sku, v.attributes, v.unit_cost AS "unitCost",
              v.selling_price AS "sellingPrice", v.active,
              COALESCE(SUM(m.quantity), 0)::int AS "onHand"
       FROM product_variant v
       LEFT JOIN stock_movement m ON m.variant_id = v.id
       WHERE v.product_id = $1
       GROUP BY v.id
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
    for (const [field, value] of [
      ['unitCost', input.unitCost],
      ['sellingPrice', input.sellingPrice],
    ] as const) {
      if (value !== undefined && value !== '' && !MONEY.test(value)) {
        throw new BadRequestException(`${field} must be an amount like 120.50`);
      }
    }
    if (input.openingStock !== undefined && !Number.isInteger(input.openingStock)) {
      throw new BadRequestException('opening stock must be a whole number');
    }

    return this.db.transaction(async (tx) => {
      const product = await tx.save(Product, {
        name: input.name.trim(),
        category: input.category?.trim() || null,
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
      return { ...product, variantId: variant.id };
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

    return this.addMovement(this.db.manager, variantId, quantity, reason, userId, note, variant.unitCost);
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

  /** Variants an order line can be attached to, for the manual order form. */
  searchVariants(term: string) {
    return this.db.query(
      `SELECT v.id, v.sku, v.selling_price AS "sellingPrice",
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
   * Pulls the live Easy Orders catalogue and maps each product to one of ours.
   *
   * Easy Orders has no SKU, so products are matched by the external UUID we
   * have already seen. Anything unrecognised becomes a new product plus a
   * listing, which is what makes incoming website orders resolve to stock.
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

    let created = 0;
    let updated = 0;

    for (const remote of products) {
      if (!remote?.id) continue;
      await this.db.transaction(async (tx) => {
        const existing = await tx.findOne(ChannelListing, {
          where: { channel: 'easyorders', externalId: remote.id, externalVariantId: '' },
        });

        if (existing) {
          existing.title = remote.name?.trim() || existing.title;
          existing.price = remote.price != null ? String(remote.price) : existing.price;
          await tx.save(existing);
          updated++;
          return;
        }

        const product = await tx.save(Product, {
          name: remote.name?.trim() || remote.slug || remote.id,
          discovered: true,
          active: true,
        });
        const variant = await tx.save(ProductVariant, {
          productId: product.id,
          name: 'Default',
          attributes: {},
          sellingPrice: remote.price != null ? String(remote.price) : null,
        });
        await tx.save(ChannelListing, {
          channel: 'easyorders' as const,
          externalId: remote.id,
          externalVariantId: '',
          title: remote.name?.trim() || null,
          price: remote.price != null ? String(remote.price) : null,
          variantId: variant.id,
        });
        created++;
      });
    }

    this.log.log(`easyorders catalogue sync: ${created} created, ${updated} updated`);
    return { fetched: products.length, created, updated };
  }
}
