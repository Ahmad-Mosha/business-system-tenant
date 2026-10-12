/**
 * The purchase-line arithmetic the API applies (apps/api purchasing/costing.ts),
 * so the invoice on screen is the invoice that gets saved. Exact integer maths:
 * whichever of unit cost or line total was typed is kept, the other derived.
 */
function toUnits(value: string, places: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt((whole || '0') + fraction.padEnd(places, '0').slice(0, places));
}

function fromUnits(units: bigint, places: number): string {
  const digits = units.toString().padStart(places + 1, '0');
  return `${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

/** 3 × 33.3333 → `100.00` (to the cent, half up). */
export function lineTotalFor(unitCost: string, quantity: number): string {
  return fromUnits((toUnits(unitCost, 4) * BigInt(quantity) + BigInt(50)) / BigInt(100), 2);
}

/** 3 pieces for 100 → `33.3333` (4 decimals, half up). */
export function unitCostFor(lineTotal: string, quantity: number): string {
  const q = BigInt(quantity);
  return fromUnits((toUnits(lineTotal, 2) * BigInt(200) + q) / (BigInt(2) * q), 4);
}

/** `33.3300` → `33.33`, `25.0000` → `25` — a derived figure shown without padding. */
export const trimZeros = (value: string) => (value.includes('.') ? value.replace(/\.?0+$/, '') : value);

export interface PricedLine {
  quantity: string;
  unitCost: string;
  lineTotal?: string;
  /** Which figure the person typed — it stays fixed when the quantity changes. */
  source?: 'unit' | 'total';
}

/** A line's unit cost and total as shown and saved; empty while it cannot be worked out. */
export function priceLine(line: PricedLine): { unitCost: string; lineTotal: string } {
  const q = Number(line.quantity);
  const whole = Number.isInteger(q) && q > 0;
  if (line.source === 'total') {
    const total = line.lineTotal ?? '';
    return { lineTotal: total, unitCost: whole && total ? trimZeros(unitCostFor(total, q)) : '' };
  }
  return { unitCost: line.unitCost, lineTotal: whole && line.unitCost ? lineTotalFor(line.unitCost, q) : '' };
}
