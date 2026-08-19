import {
  PERMISSIONS,
  type ListVariantsQuery,
  type ListVariantsResponse,
  type SalesChannel,
  type VariantDetail,
} from '@app/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { DB, schema, type Database } from '../../db/db.module.js';
import { DomainError } from '../../shared/errors.js';
import { newId } from '../../shared/ids.js';
import type { AuthContext } from '../identity/auth-context.js';

export class VariantNotFoundError extends DomainError {
  constructor() {
    super('VARIANT_NOT_FOUND', 'That product is not in your catalog', 404);
  }
}

export interface UpsertListingInput {
  organizationId: string;
  channel: SalesChannel;
  externalId: string;
  externalSku?: string | null;
  title: string;
  price?: number | null;
  imageUrl?: string | null;
  description?: string | null;
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listVariants(
    auth: AuthContext,
    query: ListVariantsQuery,
  ): Promise<ListVariantsResponse> {
    auth.requireScope(PERMISSIONS.CATALOG_READ);

    const conditions: SQL[] = [eq(schema.variants.organizationId, auth.user.organizationId)];
    if (query.search) {
      const term = `%${query.search}%`;
      const match = or(
        ilike(schema.variants.sku, term),
        ilike(schema.variants.name, term),
        ilike(schema.products.name, term),
      );
      if (match) conditions.push(match);
    }
    const where = and(...conditions);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          id: schema.variants.id,
          sku: schema.variants.sku,
          name: schema.variants.name,
          productName: schema.products.name,
          imageUrl: schema.products.imageUrl,
          active: schema.variants.active,
          channels: sql<string[]>`coalesce(array_agg(distinct ${schema.channelListings.channel}) filter (where ${schema.channelListings.id} is not null), '{}')`,
          listingCount: sql<number>`count(distinct ${schema.channelListings.id})::int`,
          // bigint aggregates come back as strings from postgres.js; cast to integer so the
          // API's own contract (fromPrice: number) is actually true, not just claimed.
          fromPrice: sql<number | null>`min(${schema.channelListings.price})::integer`,
        })
        .from(schema.variants)
        .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
        .leftJoin(
          schema.listingComponents,
          eq(schema.listingComponents.variantId, schema.variants.id),
        )
        .leftJoin(
          schema.channelListings,
          eq(schema.channelListings.id, schema.listingComponents.listingId),
        )
        .where(where)
        .groupBy(schema.variants.id, schema.products.name, schema.products.imageUrl)
        .orderBy(asc(schema.variants.sku))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ value: count() })
        .from(schema.variants)
        .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
        .where(where),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        sku: r.sku,
        name: r.name,
        productName: r.productName,
        imageUrl: r.imageUrl,
        fromPrice: r.fromPrice,
        currency: 'EGP',
        listingCount: r.listingCount,
        channels: (r.channels ?? []) as SalesChannel[],
        active: r.active,
      })),
      total: totals?.value ?? 0,
    };
  }

  /** One variant with every channel it is listed on. */
  async getVariant(auth: AuthContext, variantId: string): Promise<VariantDetail> {
    auth.requireScope(PERMISSIONS.CATALOG_READ);

    const [variant] = await this.db
      .select({
        id: schema.variants.id,
        sku: schema.variants.sku,
        name: schema.variants.name,
        active: schema.variants.active,
        createdAt: schema.variants.createdAt,
        productId: schema.products.id,
        productName: schema.products.name,
        description: schema.products.description,
        imageUrl: schema.products.imageUrl,
      })
      .from(schema.variants)
      .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
      .where(
        and(
          eq(schema.variants.id, variantId),
          eq(schema.variants.organizationId, auth.user.organizationId),
        ),
      )
      .limit(1);

    if (!variant) throw new VariantNotFoundError();

    const listings = await this.db
      .select({
        id: schema.channelListings.id,
        channel: schema.channelListings.channel,
        externalId: schema.channelListings.externalId,
        externalSku: schema.channelListings.externalSku,
        title: schema.channelListings.title,
        price: sql<number | null>`${schema.channelListings.price}::integer`,
        active: schema.channelListings.active,
        quantityPerUnit: schema.listingComponents.quantity,
      })
      .from(schema.listingComponents)
      .innerJoin(
        schema.channelListings,
        eq(schema.channelListings.id, schema.listingComponents.listingId),
      )
      .where(eq(schema.listingComponents.variantId, variantId))
      .orderBy(asc(schema.channelListings.channel));

    return {
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      active: variant.active,
      productId: variant.productId,
      productName: variant.productName,
      description: variant.description,
      imageUrl: variant.imageUrl,
      currency: 'EGP',
      listings,
      createdAt: variant.createdAt.toISOString(),
    };
  }

  /**
   * Resolves a channel's own identifier to internal variants.
   *
   * This is the join that makes one product sold on three channels decrement one
   * stock figure: every channel listing, whatever the provider calls it, points at
   * the same variant.
   */
  async resolveListing(
    organizationId: string,
    channel: SalesChannel,
    externalId: string,
  ): Promise<{ listingId: string; components: { variantId: string; quantity: number }[] } | null> {
    const [listing] = await this.db
      .select({ id: schema.channelListings.id })
      .from(schema.channelListings)
      .where(
        and(
          eq(schema.channelListings.organizationId, organizationId),
          eq(schema.channelListings.channel, channel),
          eq(schema.channelListings.externalId, externalId),
        ),
      )
      .limit(1);

    if (!listing) return null;

    const components = await this.db
      .select({
        variantId: schema.listingComponents.variantId,
        quantity: schema.listingComponents.quantity,
      })
      .from(schema.listingComponents)
      .where(eq(schema.listingComponents.listingId, listing.id));

    return { listingId: listing.id, components };
  }

  /**
   * Creates the product, variant and listing for a channel item we have not seen.
   *
   * Used by catalog import, where the operator has explicitly asked to pull a
   * channel's products in. Order ingestion does NOT call this - an unknown SKU
   * arriving on an order is a mapping decision for a human, not an invention.
   */
  async importListingAsNewProduct(input: UpsertListingInput): Promise<{
    listingId: string;
    variantId: string;
    created: boolean;
  }> {
    const existing = await this.resolveListing(
      input.organizationId,
      input.channel,
      input.externalId,
    );
    if (existing?.components[0]) {
      await this.db
        .update(schema.channelListings)
        .set({ title: input.title, price: input.price ?? null, updatedAt: new Date() })
        .where(eq(schema.channelListings.id, existing.listingId));
      return {
        listingId: existing.listingId,
        variantId: existing.components[0].variantId,
        created: false,
      };
    }

    const productId = newId();
    const variantId = newId();
    const listingId = newId();
    const sku = input.externalSku?.trim() || (await this.nextInternalSku(input.organizationId));

    await this.db.transaction(async (tx) => {
      await tx.insert(schema.products).values({
        id: productId,
        organizationId: input.organizationId,
        name: input.title,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
      });
      await tx.insert(schema.variants).values({
        id: variantId,
        organizationId: input.organizationId,
        productId,
        sku,
        name: input.title,
      });
      await tx.insert(schema.channelListings).values({
        id: listingId,
        organizationId: input.organizationId,
        channel: input.channel,
        externalId: input.externalId,
        externalSku: input.externalSku ?? null,
        title: input.title,
        price: input.price ?? null,
      });
      await tx
        .insert(schema.listingComponents)
        .values({ listingId, variantId, quantity: 1 });
    });

    return { listingId, variantId, created: true };
  }

  /**
   * Internal SKUs are ours: stable, readable, and independent of any channel.
   * Sequential per organization, so they stay short and sortable.
   */
  private async nextInternalSku(organizationId: string): Promise<string> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.variants)
      .where(eq(schema.variants.organizationId, organizationId));
    const next = (row?.value ?? 0) + 1;
    return `SKU-${String(next).padStart(5, '0')}`;
  }
}
