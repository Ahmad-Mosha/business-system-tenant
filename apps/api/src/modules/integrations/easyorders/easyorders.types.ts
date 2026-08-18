import { z } from 'zod';

/**
 * EasyOrders' own shapes. These stay inside the adapter: nothing outside this
 * folder may import them, so the domain never learns what EasyOrders looks like.
 *
 * Every field beyond the ones we rely on is deliberately not modelled - the
 * provider adds fields freely and we must not break when it does.
 */
export const easyOrdersProductSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    price: z.number().nullable().optional(),
    sale_price: z.number().nullable().optional(),
    sku: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    thumb: z.string().nullable().optional(),
    quantity: z.number().nullable().optional(),
    track_stock: z.boolean().nullable().optional(),
    hidden: z.boolean().nullable().optional(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

export type EasyOrdersProduct = z.infer<typeof easyOrdersProductSchema>;

export const easyOrdersProductListSchema = z.array(easyOrdersProductSchema);
