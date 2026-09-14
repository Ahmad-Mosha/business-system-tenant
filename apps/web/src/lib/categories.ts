import { House, Package, Plug, Sparkles, Tv, type LucideIcon } from 'lucide-react';

/**
 * The business's fixed category vocabulary — mirrors PRODUCT_CATEGORIES on the
 * API. One definition, so the filter chips, the product form, and the table
 * all show the same four options in the same order. Names: `enums.category`.
 */
export const CATEGORIES = ['COSMETICS', 'HOME', 'ELECTRONICS', 'TV_SHOP'] as const;

export type Category = (typeof CATEGORIES)[number];

const ICONS: Record<string, LucideIcon> = {
  COSMETICS: Sparkles,
  HOME: House,
  ELECTRONICS: Plug,
  TV_SHOP: Tv,
};

/** A product has no photo in the system, so a list shows its category's icon instead. */
export const categoryIcon = (value: string | null): LucideIcon =>
  (value && ICONS[value]) || Package;
