import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * The tenant every business row belongs to. One row exists today — Prime
 * Market itself. Nothing in the product is tenant-aware beyond this column and
 * the policies below; there is no signup, no billing and no tenant switcher.
 *
 * It is here from the first migration because adding it later means rewriting
 * every table, every query and every endpoint.
 */
export const tenants = pgTable('tenant', {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const USER_ROLES = ['ADMIN', 'MODERATOR'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Admin sees and does everything. Moderator handles customers, creates manual
 * orders that are assigned to them, and follows shipping on those orders only.
 * Moderators never see money.
 */
export const users = pgTable(
  'app_user',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    email: text().notNull(),
    name: text().notNull(),
    /** scrypt, stored as `salt:hash`. Never leaves the server. */
    passwordHash: text().notNull(),
    role: text({ enum: USER_ROLES }).notNull(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_user_email').on(t.tenantId, sql`lower(${t.email})`),
    index('ix_user_tenant').on(t.tenantId),
    // Second line of defence. The application filters by tenant as well; this
    // is what holds when someone forgets to.
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'prime_app',
      using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    }),
  ],
).enableRLS();

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
}));

/**
 * The four categories the business uses. Electronics and TV Shop have no
 * products in the starting data, but they are part of the vocabulary.
 */
export const CATEGORIES = ['COSMETICS', 'HOME', 'ELECTRONICS', 'TV_SHOP'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS_AR: Record<Category, string> = {
  COSMETICS: 'مستحضرات تجميل',
  HOME: 'منزلي',
  ELECTRONICS: 'إلكترونيات',
  TV_SHOP: 'تي في شوب',
};

/**
 * The internal product. Its id is the identity — never a channel's SKU.
 *
 * There is no price here. Price differs per channel and per order, so it
 * belongs to the order line. Cost is not here either: it comes from what was
 * actually paid on each goods receipt.
 */
export const products = pgTable(
  'product',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    /** Arabic, exactly as the business writes it. */
    name: text().notNull(),
    category: text({ enum: CATEGORIES }).notNull(),
    notes: text(),
    /** Archived rather than deleted — order history keeps pointing at it. */
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ix_product_tenant').on(t.tenantId),
    index('ix_product_category').on(t.tenantId, t.category),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'prime_app',
      using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    }),
  ],
).enableRLS();

/**
 * The thing that actually holds stock. A product with no size or colour still
 * gets exactly one variant, so every stock row and order line points at a
 * variant and there is never a second code path.
 */
export const variants = pgTable(
  'product_variant',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    /**
     * Size, colour, design. Open as a map because the business has not fixed
     * the list, and a column per attribute would need a migration each time
     * one is added.
     */
    attributes: jsonb().$type<Record<string, string>>().notNull().default({}),
    /** Our own optional code. Never a channel's. */
    code: text(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ix_variant_product').on(t.productId),
    uniqueIndex('uq_variant_code').on(t.tenantId, t.code),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'prime_app',
      using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    }),
  ],
).enableRLS();

export const CHANNELS = ['NOON', 'AMAZON', 'EASYORDERS', 'SOCIAL'] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * What a channel calls one of our variants.
 *
 * This is the table an arriving noon settlement row or Easy Orders webhook
 * resolves against. Many listings point at one variant, which is the entire
 * point: the same item sold on three channels must move one stock pool.
 *
 * External identifiers are opaque strings. noon renames a Partner SKU, Amazon
 * turns up with an ASIN, a channel delists something — all of it lands here
 * and never touches product identity, stock or order history.
 */
export const channelListings = pgTable(
  'channel_listing',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    variantId: uuid()
      .notNull()
      .references(() => variants.id, { onDelete: 'restrict' }),
    channel: text({ enum: CHANNELS }).notNull(),
    /** noon: Partner SKU. Easy Orders: product UUID. Amazon: unknown yet. */
    externalId: text().notNull(),
    /** Easy Orders variant UUID, noon's own SKU. Empty when the channel has none. */
    externalVariantId: text().notNull().default(''),
    /** What the channel displays. Kept for recognising a listing, never for matching. */
    label: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_listing_external').on(
      t.tenantId,
      t.channel,
      t.externalId,
      t.externalVariantId,
    ),
    index('ix_listing_variant').on(t.variantId),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: 'prime_app',
      using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    }),
  ],
).enableRLS();

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(variants),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
  listings: many(channelListings),
}));

export const listingsRelations = relations(channelListings, ({ one }) => ({
  variant: one(variants, { fields: [channelListings.variantId], references: [variants.id] }),
}));
