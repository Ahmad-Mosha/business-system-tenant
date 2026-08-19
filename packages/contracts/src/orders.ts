import { z } from 'zod';

/**
 * The canonical order lifecycle. Provider-specific statuses are mapped onto this;
 * an unmapped external status is never guessed at.
 *
 * DELIVERED, RETURNED and COLLECTED are outcomes that a courier or a payout
 * ultimately confirms. They are settable by a person today; when the courier
 * integration lands it becomes the authority for delivery outcomes and people
 * stop setting them by hand. The state survives - only who sets it changes.
 */
export const orderStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'CONFIRMED',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'COLLECTED',
  'RETURNED',
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
  DELIVERED: 'Delivered',
  COLLECTED: 'Collected',
  RETURNED: 'Returned',
  ON_HOLD: 'On hold',
  CANCELLED: 'Cancelled',
};

/**
 * What each state means in plain language, shown in the status menu so the
 * workflow explains itself rather than relying on the reader knowing the enum.
 */
export const ORDER_STATUS_MEANING: Record<OrderStatus, string> = {
  NEW: 'Just arrived, nobody has worked it yet',
  CONTACTED: 'You have reached the customer',
  CONFIRMED: 'Customer confirmed what they want',
  READY_TO_SHIP: 'Packed and waiting for the courier',
  SHIPPED: 'Handed over to the courier',
  DELIVERED: 'Courier delivered it to the customer',
  COLLECTED: 'Money received and in our account',
  RETURNED: 'Came back to us instead of being delivered',
  ON_HOLD: 'Blocked - waiting on someone or something',
  CANCELLED: 'This order will not go ahead',
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
 * COLLECTED is the money-landed marker: for cash on delivery the cash sits with
 * the courier after DELIVERED until they remit it, and that gap is real working
 * capital the finance slice will need to account for.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONTACTED', 'ON_HOLD', 'CANCELLED'],
  CONTACTED: ['CONFIRMED', 'ON_HOLD', 'CANCELLED'],
  CONFIRMED: ['READY_TO_SHIP', 'ON_HOLD', 'CANCELLED'],
  READY_TO_SHIP: ['SHIPPED', 'ON_HOLD', 'CANCELLED'],
  // Once it is with the courier the outcome is delivery or return, not a
  // free jump back into the office workflow.
  SHIPPED: ['DELIVERED', 'RETURNED', 'ON_HOLD'],
  // Delivered but not yet paid out: for cash on delivery the money sits with
  // the courier until they remit it, which is exactly what COLLECTED marks.
  DELIVERED: ['COLLECTED', 'RETURNED'],
  // Money is in our account. A late refund still has to be representable.
  COLLECTED: ['RETURNED'],
  RETURNED: [],
  ON_HOLD: ['CONTACTED', 'CONFIRMED', 'READY_TO_SHIP', 'SHIPPED', 'CANCELLED'],
  CANCELLED: [],
};

/**
 * Statuses that mean money has actually reached us. Kept here so the finance
 * slice and the UI agree on what "paid" means instead of each hard-coding it.
 */
export const SETTLED_STATUSES: OrderStatus[] = ['COLLECTED'];

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
  /** Matches order number, customer name or phone. */
  search: z.string().trim().max(120).optional(),
  assigneeId: z.string().uuid().optional(),
  /** Inclusive placed-at bounds, as YYYY-MM-DD in Africa/Cairo. */
  placedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  placedTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const listOrdersResponseSchema = z.object({
  items: z.array(orderListItemSchema),
  total: z.number().int(),
});
export type ListOrdersResponse = z.infer<typeof listOrdersResponseSchema>;
