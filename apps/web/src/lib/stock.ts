import type { Tone } from '@/components/tone-badge';

/** At or under this many units a product is low — the API's `low_stock` filter draws the same line. */
export const LOW_STOCK = 5;

/** Which of `enums.stockState` a count is in, and how it looks. */
export function stockState(onHand: number): { tone: Tone; key: 'in' | 'low' | 'out' } {
  if (onHand <= 0) return { tone: 'danger', key: 'out' };
  if (onHand <= LOW_STOCK) return { tone: 'warning', key: 'low' };
  return { tone: 'success', key: 'in' };
}
