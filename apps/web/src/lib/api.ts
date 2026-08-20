const API = process.env.API_URL ?? 'http://localhost:3001';

export interface Statement {
  from: string;
  to: string;
  openingBalance: string;
  netProceeds: string;
  referralFee: string;
  fulfilmentFee: string;
  shippingCredits: string;
  otherOrderFees: string;
  orderSubsidies: string;
  advertisingFee: string;
  advertisingSubsidy: string;
  fees: string;
  payouts: string;
  movement: string;
  rows: number;
  closingBalance: string;
}

export interface ProductPerformance {
  productId: string;
  name: string;
  discovered: boolean;
  unitCost: string | null;
  unitsSold: number;
  unitsReturned: number;
  netProceeds: string;
  referralFee: string;
  fulfilmentFee: string;
  otherFees: string;
  net: string;
  grossProfit: string | null;
}

export interface Unattributed {
  transactionType: string;
  rows: number;
  total: string;
}

export interface ImportRecord {
  id: string;
  filename: string;
  rowsInFile: number;
  rowsInserted: number;
  rowsSkipped: number;
  productsDiscovered: number;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

/**
 * Server-side fetch. `no-store` because operations data changes on every
 * import and a stale figure here is worse than a round trip.
 */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

const range = (from: string, to: string) => `from=${from}&to=${to}`;

export const getImports = () => get<ImportRecord[]>('/noon/imports');

export const getStatement = (from: string, to: string, openingBalance = '0') =>
  get<Statement>(`/noon/statement?${range(from, to)}&openingBalance=${openingBalance}`);

export const getProducts = (from: string, to: string) =>
  get<ProductPerformance[]>(`/noon/products?${range(from, to)}`);

export const getUnattributed = (from: string, to: string) =>
  get<Unattributed[]>(`/noon/unattributed?${range(from, to)}`);

/**
 * The window every page defaults to: everything we hold. Derived from the
 * imports themselves so the UI is never pinned to a hard-coded month.
 */
export async function getDataRange(): Promise<{ from: string; to: string } | null> {
  const imports = await getImports();
  const starts = imports.map((i) => i.periodStart).filter((d): d is string => !!d);
  const ends = imports.map((i) => i.periodEnd).filter((d): d is string => !!d);
  if (!starts.length || !ends.length) return null;
  return { from: starts.sort()[0], to: ends.sort()[ends.length - 1] };
}
