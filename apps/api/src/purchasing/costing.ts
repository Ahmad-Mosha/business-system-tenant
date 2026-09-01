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
 * The shares sum to exactly `extra` at 2dp — the last line absorbs any rounding
 * remainder — so landed cost always reconciles to what was actually paid.
 */
export function allocateExtraCosts(
  lines: AllocatableLine[],
  extra: number,
  method: 'BY_VALUE' | 'PER_UNIT',
): number[] {
  if (lines.length === 0) return [];
  const totalValue = lines.reduce((s, l) => s + l.lineTotal, 0);
  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);

  let allocated = 0;
  return lines.map((l, i) => {
    if (i === lines.length - 1) return round2(extra - allocated);
    const basis =
      method === 'BY_VALUE'
        ? totalValue > 0
          ? l.lineTotal / totalValue
          : 1 / lines.length
        : totalUnits > 0
          ? l.quantity / totalUnits
          : 1 / lines.length;
    const share = round2(extra * basis);
    allocated += share;
    return share;
  });
}
