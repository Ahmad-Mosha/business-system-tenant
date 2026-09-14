import { House, Package, Plug, Sparkles, Tv, type LucideIcon } from 'lucide-react';

/**
 * The business's fixed category vocabulary — mirrors PRODUCT_CATEGORIES on the
 * API. One definition, so the filter chips, the product form, and the table
 * all show the same four options in the same order.
 */
export const CATEGORIES = [
  { value: 'COSMETICS', label: 'Cosmetics' },
  { value: 'HOME', label: 'Home' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'TV_SHOP', label: 'TV Shop' },
] as const;

export type Category = (typeof CATEGORIES)[number]['value'];

const LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

export const categoryLabel = (value: string | null): string =>
  value ? (LABELS[value] ?? value) : 'Uncategorised';

const ICONS: Record<string, LucideIcon> = {
  COSMETICS: Sparkles,
  HOME: House,
  ELECTRONICS: Plug,
  TV_SHOP: Tv,
};

/** A product has no photo in the system, so a list shows its category's icon instead. */
export const categoryIcon = (value: string | null): LucideIcon =>
  (value && ICONS[value]) || Package;
