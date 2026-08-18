import { z } from 'zod';

/**
 * The canonical order lifecycle. Provider-specific statuses are mapped onto this;
 * an unmapped external status is never guessed at.
 *
 * DELIVERED and RETURNED are deliberately absent: those become facts only when a
 * courier reports them, and the courier integration does not exist yet. Adding them
 * now would create a second source of truth for the same event.
 */
export const orderStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'CONFIRMED',
  'READY_TO_SHIP',
  'SHIPPED',
  'ON_HOLD',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  CONFIRMED: 'Confirmed',
  READY_TO_SHIP: 'Ready to ship',
  SHIPPED: 'Shipped',
  ON_HOLD: 'On hold',
  CANCELLED: 'Cancelled',
};

/** Where an order entered the system. Marketplaces join this list in later slices. */
export const orderSourceSchema = z.enum(['MANUAL', 'EASYORDERS']);
export type OrderSource = z.infer<typeof orderSourceSchema>;

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  MANUAL: 'Manual',
  EASYORDERS: 'EasyOrders',
};

export const assigneeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

/** Amounts are integer minor units (piastres) plus an explicit currency. Never floats. */
export const moneySchema = z.object({
  amount: z.number().int(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof moneySchema>;

export const orderListItemSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  source: orderSourceSchema,
  status: orderStatusSchema,
  customerName: z.string(),
  customerPhone: z.string(),
  total: moneySchema,
  assignedTo: assigneeSchema.nullable(),
  placedAt: z.string().datetime(),
});
export type OrderListItem = z.infer<typeof orderListItemSchema>;

export const listOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const listOrdersResponseSchema = z.object({
  items: z.array(orderListItemSchema),
  total: z.number().int(),
});
export type ListOrdersResponse = z.infer<typeof listOrdersResponseSchema>;
