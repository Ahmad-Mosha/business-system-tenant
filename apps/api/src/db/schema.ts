import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
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
