import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, ilike, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service.js';
import { channelListings, products, variants } from '../db/schema.js';
import type {
  CreateListingDto,
  CreateProductDto,
  CreateVariantDto,
  ListProductsQuery,
  ProductDetailDto,
  ProductPageDto,
  UpdateProductDto,
} from './dto.js';

/** Postgres reports a broken unique index this way. */
const UNIQUE_VIOLATION = '23505';

/**
 * Drizzle wraps the driver error, so the pg code sits on `cause` rather than
 * on the error itself. Walking the chain is what turns a 500 into the 409 the
 * caller can act on.
 */
function isUniqueViolation(e: unknown): boolean {
  for (let cur = e; cur; cur = (cur as { cause?: unknown }).cause) {
    if ((cur as { code?: string }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

@Injectable()
export class CatalogueService {
  constructor(private readonly db: DbService) {}

  async list(tenantId: string, query: ListProductsQuery): Promise<ProductPageDto> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const active = query.active ?? true;

    const where = and(
      eq(products.active, active),
      query.category ? eq(products.category, query.category) : undefined,
      // ponytail: ILIKE scans, which is nothing at 135 rows. Add a trigram
      // index if the catalogue ever reaches thousands.
      query.search ? ilike(products.name, `%${query.search}%`) : undefined,
    );

    return this.db.asTenant(tenantId, async (tx) => {
      const items = await tx
        .select({
          id: products.id,
          name: products.name,
          category: products.category,
          notes: products.notes,
          active: products.active,
          // Written out rather than composed: drizzle inlines a column
          // reference unqualified, and "id" is ambiguous once the subquery
          // has its own table in scope.
          variantCount: sql<number>`(
            select count(*)::int from product_variant v where v.product_id = product.id
          )`.as('variant_count'),
          listingCount: sql<number>`(
            select count(*)::int from channel_listing l
            join product_variant v on v.id = l.variant_id
            where v.product_id = product.id
          )`.as('listing_count'),
        })
        .from(products)
        .where(where)
        .orderBy(asc(products.name))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await tx
        .select({ total: count() })
        .from(products)
        .where(where);

      return { items, total, limit, offset };
    });
  }

  async get(tenantId: string, id: string): Promise<ProductDetailDto> {
    return this.db.asTenant(tenantId, async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, id));
      if (!product) throw new NotFoundException(`No product with id ${id}`);

      const rows = await tx
        .select({ variant: variants, listing: channelListings })
        .from(variants)
        .leftJoin(channelListings, eq(channelListings.variantId, variants.id))
        .where(eq(variants.productId, id))
        .orderBy(asc(variants.createdAt));

      // One row per variant/listing pair comes back; fold them into variants.
      const byVariant = new Map<string, ProductDetailDto['variants'][number]>();
      for (const { variant, listing } of rows) {
        let entry = byVariant.get(variant.id);
        if (!entry) {
          entry = {
            id: variant.id,
            attributes: variant.attributes,
            code: variant.code,
            active: variant.active,
            listings: [],
          };
          byVariant.set(variant.id, entry);
        }
        if (listing) {
          entry.listings.push({
            id: listing.id,
            channel: listing.channel,
            externalId: listing.externalId,
            externalVariantId: listing.externalVariantId,
            label: listing.label,
          });
        }
      }

      const list = [...byVariant.values()];
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        notes: product.notes,
        active: product.active,
        variantCount: list.length,
        listingCount: list.reduce((n, v) => n + v.listings.length, 0),
        variants: list,
      };
    });
  }

  async create(tenantId: string, body: CreateProductDto): Promise<ProductDetailDto> {
    const id = await this.db.asTenant(tenantId, async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({ tenantId, name: body.name.trim(), category: body.category, notes: body.notes })
        .returning({ id: products.id });

      // A product always has at least one variant, so stock and orders have
      // exactly one thing to point at and there is no second code path.
      await tx.insert(variants).values({ tenantId, productId: product.id });
      return product.id;
    });

    return this.get(tenantId, id);
  }

  async update(tenantId: string, id: string, body: UpdateProductDto): Promise<ProductDetailDto> {
    await this.db.asTenant(tenantId, async (tx) => {
      const [updated] = await tx
        .update(products)
        .set({
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning({ id: products.id });

      if (!updated) throw new NotFoundException(`No product with id ${id}`);
    });

    return this.get(tenantId, id);
  }

  async addVariant(tenantId: string, productId: string, body: CreateVariantDto) {
    return this.db.asTenant(tenantId, async (tx) => {
      const [product] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, productId));
      if (!product) throw new NotFoundException(`No product with id ${productId}`);

      try {
        const [variant] = await tx
          .insert(variants)
          .values({
            tenantId,
            productId,
            attributes: body.attributes ?? {},
            code: body.code?.trim() || null,
          })
          .returning();
        return { id: variant.id, attributes: variant.attributes, code: variant.code, active: variant.active, listings: [] };
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new ConflictException(`Code "${body.code}" is already used by another variant`);
        }
        throw e;
      }
    });
  }

  async addListing(tenantId: string, variantId: string, body: CreateListingDto) {
    return this.db.asTenant(tenantId, async (tx) => {
      const [variant] = await tx
        .select({ id: variants.id })
        .from(variants)
        .where(eq(variants.id, variantId));
      if (!variant) throw new NotFoundException(`No variant with id ${variantId}`);

      try {
        const [listing] = await tx
          .insert(channelListings)
          .values({
            tenantId,
            variantId,
            channel: body.channel,
            externalId: body.externalId.trim(),
            externalVariantId: body.externalVariantId?.trim() ?? '',
            label: body.label,
          })
          .returning();
        return {
          id: listing.id,
          channel: listing.channel,
          externalId: listing.externalId,
          externalVariantId: listing.externalVariantId,
          label: listing.label,
        };
      } catch (e) {
        // The same external id must never point at two variants — that is how
        // an arriving sale ends up decrementing the wrong stock.
        if (isUniqueViolation(e)) {
          throw new ConflictException(
            `${body.channel} "${body.externalId}" is already mapped to another variant`,
          );
        }
        throw e;
      }
    });
  }

  async removeListing(tenantId: string, listingId: string): Promise<void> {
    await this.db.asTenant(tenantId, async (tx) => {
      const [deleted] = await tx
        .delete(channelListings)
        .where(eq(channelListings.id, listingId))
        .returning({ id: channelListings.id });
      if (!deleted) throw new NotFoundException(`No listing with id ${listingId}`);
    });
  }

  /** Counts for the catalogue header, in one round trip. */
  async summary(tenantId: string) {
    return this.db.asTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({ category: products.category, total: count() })
        .from(products)
        .where(eq(products.active, true))
        .groupBy(products.category);

      const [{ listings }] = await tx
        .select({ listings: count() })
        .from(channelListings);

      // Products no arriving sale can attach to. This is the number that
      // matters before an import runs.
      const [{ unmapped }] = await tx.execute<{ unmapped: number }>(sql`
        select count(*)::int as unmapped
        from product p
        where p.active
          and not exists (
            select 1 from product_variant v
            join channel_listing l on l.variant_id = v.id
            where v.product_id = p.id
          )
      `).then((r) => r.rows);

      return {
        byCategory: Object.fromEntries(rows.map((r) => [r.category, r.total])),
        products: rows.reduce((n, r) => n + r.total, 0),
        listings,
        unmapped,
      };
    });
  }
}
