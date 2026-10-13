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

/** A non-negative decimal string as an integer count of 10^-places, e.g. `12.5` at 2 places → 1250n. */
function toUnits(value: string, places: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(places, '0').slice(0, places));
}

function fromUnits(units: bigint, places: number): string {
  const digits = units.toString().padStart(places + 1, '0');
  return `${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

/**
 * A purchase line typed as quantity × unit cost (up to 4 decimals): the line
 * total to the cent, half up, in exact integer arithmetic. 3 × 33.3333 = 100.00.
 */
export function lineTotalFor(unitCost: string, quantity: number): string {
  return fromUnits((toUnits(unitCost, 4) * BigInt(quantity) + 50n) / 100n, 2);
}

/**
 * A purchase line typed as quantity + line total: the unit cost to 4 decimals,
 * half up. The typed total stays the line's amount — 3 pieces for 100.00 cost
 * 100.00, never 3 × 33.33 = 99.99.
 */
export function unitCostFor(lineTotal: string, quantity: number): string {
  const q = BigInt(quantity);
  return fromUnits((toUnits(lineTotal, 2) * 200n + q) / (2n * q), 4);
}
