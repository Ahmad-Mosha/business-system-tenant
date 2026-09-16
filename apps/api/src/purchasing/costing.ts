/** Round to 2 decimal places without floating-point drift on the common cases. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const round4 = (n: number): number => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Moving weighted-average cost (AVCO) after receiving stock. Below or at zero
 * on hand — or no cost on file yet — the incoming cost simply becomes the
 * average; there is nothing to blend it with.
 */
export function movingAverage(
  onHand: number,
  oldAvg: number | null,
  qtyIn: number,
  costIn: number,
): number {
  if (onHand <= 0 || oldAvg === null) return round4(costIn);
  return round4((onHand * oldAvg + qtyIn * costIn) / (onHand + qtyIn));
}

/**
 * Spreads a payment across invoice remainders, oldest first. Returns how much
 * each one receives; the sum equals `amount` as long as `amount` does not
 * exceed the total remainder (the caller guarantees that).
 */
export function allocateOldestFirst(remainders: number[], amount: number): number[] {
  let left = round2(amount);
  return remainders.map((r) => {
    if (left <= 0.005 || r <= 0.005) return 0;
    const apply = round2(Math.min(left, r));
    left = round2(left - apply);
    return apply;
  });
}

export interface AllocatableLine {
  lineTotal: number;
  quantity: number;
}

/**
 * Splits `extra` (shipping, customs) across lines and returns each line's share.
 * The shares sum to exactly `extra` at 2dp using largest remainders, so landed cost always reconciles to what was actually paid.
 */
export function allocateExtraCosts(
  lines: AllocatableLine[],
  extra: number,
  method: 'BY_VALUE' | 'PER_UNIT',
): number[] {
  if (lines.length === 0) return [];
  // Integer minor units + largest remainders: every share is nonnegative,
  // and many small lines can never force a negative share onto the last line.
  const cents = BigInt(Math.round(extra * 100));
  const weights = lines.map((l) => BigInt(Math.round(method === 'BY_VALUE' ? l.lineTotal * 100 : l.quantity)));
  let denominator = weights.reduce((sum, weight) => sum + weight, 0n);
  if (denominator === 0n) { weights.fill(1n); denominator = BigInt(lines.length); }
  const shares = weights.map((weight) => cents * weight / denominator);
  const ranked = weights.map((weight, index) => ({ index, remainder: cents * weight % denominator }))
    .sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  const remaining = Number(cents - shares.reduce((sum, share) => sum + share, 0n));
  for (let i = 0; i < remaining; i++) shares[ranked[i].index] += 1n;
  return shares.map((share) => Number(share) / 100);
}
