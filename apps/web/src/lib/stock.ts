import type { Tone } from '@/components/tone-badge';

/** At or under this many units a product is low — the API's `low_stock` filter draws the same line. */
export const LOW_STOCK = 5;

export function stockState(onHand: number): { tone: Tone; label: string } {
  if (onHand <= 0) return { tone: 'danger', label: 'Out of stock' };
  if (onHand <= LOW_STOCK) return { tone: 'warning', label: 'Low stock' };
  return { tone: 'success', label: 'In stock' };
}

