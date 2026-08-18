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

/**
 * Which transitions are legal, and therefore which buttons a screen may offer.
 * Declared once here so the API and the UI cannot disagree about the lifecycle.
 *
 * DELIVERED and RETURNED are absent on purpose: those are facts a courier reports,
 * and letting a person type them would create a second source of truth.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONTACTED', 'ON_HOLD', 'CANCELLED'],
  CONTACTED: ['CONFIRMED', 'ON_HOLD', 'CANCELLED'],
  CONFIRMED: ['READY_TO_SHIP', 'ON_HOLD', 'CANCELLED'],
  READY_TO_SHIP: ['SHIPPED', 'ON_HOLD', 'CANCELLED'],
  SHIPPED: [],
  ON_HOLD: ['CONTACTED', 'CONFIRMED', 'READY_TO_SHIP', 'CANCELLED'],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const orderListItemSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  source: orderSourceSchema,
  status: orderStatusSchema,
  customerName: z.string(),
  customerPhone: z.string(),
  total: moneySchema,
  assignedTo: assigneeSchema.nullable(),
  itemCount: z.number().int(),
  placedAt: z.string().datetime(),
});
export type OrderListItem = z.infer<typeof orderListItemSchema>;

export const orderLineSchema = z.object({
  id: z.string().uuid(),
  externalTitle: z.string(),
  externalSku: z.string().nullable(),
  /** Present once the line has been matched to an internal variant. */
  sku: z.string().nullable(),
  variantId: z.string().uuid().nullable(),
  resolution: z.enum(['RESOLVED', 'UNRESOLVED']),
  quantity: z.number().int(),
  unitPrice: moneySchema,
  lineTotal: moneySchema,
});
export type OrderLine = z.infer<typeof orderLineSchema>;

/** One merged, human-readable history: status changes, assignments and audit events. */
export const timelineEntrySchema = z.object({
  at: z.string().datetime(),
  kind: z.enum(['STATUS', 'ASSIGNMENT', 'AUDIT']),
  title: z.string(),
  detail: z.string().nullable(),
  actorName: z.string().nullable(),
});
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;

export const orderDetailSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  source: orderSourceSchema,
  status: orderStatusSchema,
  /** Transitions this user may perform right now, already filtered by permission. */
  availableTransitions: z.array(orderStatusSchema),
  customerName: z.string(),
  customerPhone: z.string(),
  customerAddress: z.string().nullable(),
  customerGovernorate: z.string().nullable(),
  assignedTo: assigneeSchema.nullable(),
  lines: z.array(orderLineSchema),
  itemsTotal: moneySchema,
  shippingTotal: moneySchema,
  discountTotal: moneySchema,
  total: moneySchema,
  timeline: z.array(timelineEntrySchema),
  placedAt: z.string().datetime(),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const assignOrderRequestSchema = z.object({
  assigneeId: z.string().uuid(),
});
export type AssignOrderRequest = z.infer<typeof assignOrderRequestSchema>;

export const updateOrderStatusRequestSchema = z.object({
  status: orderStatusSchema,
  note: z.string().trim().max(500).optional(),
});
export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusRequestSchema>;

/** Egyptian mobile numbers, normalised to +20 before storage. */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Enter a phone number')
  .transform((v) => v.replace(/[\s-()]/g, ''))
  .refine(
    (v) => /^(\+20|0)?1[0-9]{9}$/.test(v),
    'Enter a valid Egyptian mobile number, e.g. 01001234567',
  );

export const createOrderLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(999),
  /** Minor units. Captured per line because a manual order is often negotiated. */
  unitPrice: z.number().int().min(0),
});
export type CreateOrderLine = z.infer<typeof createOrderLineSchema>;

export const createOrderRequestSchema = z.object({
  customerName: z.string().trim().min(2, 'Enter the customer name').max(160),
  customerPhone: phoneSchema,
  customerAddress: z.string().trim().max(400).optional(),
  customerGovernorate: z.string().trim().max(80).optional(),
  shippingTotal: z.number().int().min(0).default(0),
  discountTotal: z.number().int().min(0).default(0),
  /** Admins may hand the order straight to someone; moderators keep their own. */
  assigneeId: z.string().uuid().optional(),
  lines: z.array(createOrderLineSchema).min(1, 'Add at least one product'),
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const createOrderResponseSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
});
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

export const assignableUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
});
export type AssignableUser = z.infer<typeof assignableUserSchema>;

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
