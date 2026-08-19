import { z } from 'zod';

/**
 * Where a listing is sold. Inventory never lives here - a listing resolves to
 * variants, and stock belongs to the variant.
 */
export const salesChannelSchema = z.enum(['EASYORDERS', 'AMAZON', 'NOON', 'SOCIAL']);
export type SalesChannel = z.infer<typeof salesChannelSchema>;

export const CHANNEL_LABELS: Record<SalesChannel, string> = {
  EASYORDERS: 'EasyOrders',
  AMAZON: 'Amazon',
  NOON: 'noon',
  SOCIAL: 'Social',
};

export const variantListItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  productName: z.string(),
  imageUrl: z.string().nullable(),
  /** The lowest listed price across channels, in minor units. Null if no listing has one. */
  fromPrice: z.number().int().nullable(),
  currency: z.string().length(3),
  /** How many channels this one variant is sold through. */
  listingCount: z.number().int(),
  channels: z.array(salesChannelSchema),
  active: z.boolean(),
});
export type VariantListItem = z.infer<typeof variantListItemSchema>;

export const listVariantsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListVariantsQuery = z.infer<typeof listVariantsQuerySchema>;

export const listVariantsResponseSchema = z.object({
  items: z.array(variantListItemSchema),
  total: z.number().int(),
});
export type ListVariantsResponse = z.infer<typeof listVariantsResponseSchema>;
