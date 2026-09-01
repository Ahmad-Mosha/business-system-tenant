import { authHeaders } from './session';

const API = process.env.API_URL ?? 'http://localhost:3001';

export interface Statement {
  from: string;
  to: string;
  openingBalance: string | null;
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
  closingBalance: string | null;
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

export interface Period {
  month: string;
  from: string;
  to: string;
  rows: number;
  netProceeds: string;
  fees: string;
  payouts: string;
  movement: string;
  unitsSold: number;
  openingBalance: string | null;
  closingBalance: string | null;
}

export interface ChannelAccount {
  channel: string;
  openingBalance: string;
  openingAsOf: string | null;
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
  unmappedListings: number;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

/**
 * Server-side fetch. `no-store` because operations data changes on every
 * import and a stale figure here is worse than a round trip.
 */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    cache: 'no-store',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

const range = (from: string, to: string) => `from=${from}&to=${to}`;

export const getImports = () => get<ImportRecord[]>('/noon/imports');

export const getStatement = (from: string, to: string) =>
  get<Statement>(`/noon/statement?${range(from, to)}`);

export const getPeriods = () => get<Period[]>('/noon/periods');

export const getAccount = () => get<ChannelAccount>('/noon/account');

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

export type OrderStatus =
  | 'NEW' | 'ASSIGNED' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export interface OrderRow {
  id: string;
  orderNumber: string;
  source: 'EASYORDERS' | 'SOCIAL';
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  governorate: string | null;
  total: string;
  placedAt: string;
  assignedToId: string | null;
  assignedToName: string | null;
  trackingNumber: string | null;
  itemCount: number;
  unmappedCount: number;
}

export interface OrderDetail extends Omit<OrderRow, 'assignedToName' | 'itemCount' | 'unmappedCount'> {
  address: string | null;
  notes: string | null;
  subtotal: string;
  shippingCost: string;
  externalId: string | null;
  externalStatus: string | null;
  assignedTo: { id: string; name: string } | null;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    variantId: string | null;
    externalProductId: string | null;
  }>;
  events: Array<{
    id: string;
    type: string;
    fromValue: string | null;
    toValue: string | null;
    note: string | null;
    actorName: string | null;
    createdAt: string;
  }>;
}

export interface DeliveryTimelineStep {
  code: number;
  key: string;
  label: string;
  isDone: boolean;
  date: string | null;
  description?: string | null;
}

export interface DeliveryAttempt {
  date: string | null;
  state?: number;
  driverName?: string | null;
  driverPhone?: string | null;
  hubName?: string | null;
  succeeded?: boolean;
}

export interface ShipmentTracking {
  trackingNumber: string;
  carrier: 'BOSTA';
  status: string;
  statusLabel: string;
  statusCode?: number;
  isDelayed: boolean;
  receiver: {
    name: string;
    phone: string;
    secondPhone?: string | null;
  };
  destination: {
    city?: string | null;
    zone?: string | null;
    district?: string | null;
    address?: string | null;
  };
  cod: {
    amount: number;
    currency: string;
    isCollected?: boolean;
    collectionStatus?: 'UNPAID' | 'PAID' | 'PENDING';
    collectionStatusLabel?: string;
    paymentMethodLabel?: string;
  };
  timeline: DeliveryTimelineStep[];
  attempts: {
    count: number;
    max: number;
    list: DeliveryAttempt[];
  };
  packageSpecs: {
    type?: string | null;
    typeAr?: string | null;
    description?: string | null;
    weight?: number | null;
  };
  allowOpenPackage: boolean;
  notes?: string | null;
  whatsAppConfirmation?: {
    isConfirmed: boolean;
    confirmedAt?: string | null;
  } | null;
  flexShipFee?: number | null;
  flexShipStatusLabel?: string | null;
  scheduledDeliveryDate?: string | null;
  deliveredAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface OrderSummary {
  total: number;
  unassigned: number;
  needsWork: number;
  deliveredUnpaid: number;
}

export interface Assignee {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MODERATOR';
}

export interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  discovered: boolean;
  active: boolean;
  variantCount: number;
  onHand: number;
  /** Units already off on-hand but sitting in an order that hasn't shipped,
   *  delivered or reversed — context, not a second pool of stock. */
  inOrders: number;
  unitCost: string | null;
  sellingPrice: string | null;
  channels: string[];
  /** Count across every product matching the current filters, not just this page. */
  totalCount: number;
}

export interface ProductsSummary {
  products: number;
  unitsOnHand: number;
  stockValue: string;
  missingCost: number;
  /** Sums ProductRow.inOrders across every filtered product. */
  unitsInOrders: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  category: string | null;
  discovered: boolean;
  variants: Array<{
    id: string;
    name: string;
    sku: string | null;
    attributes: Record<string, string>;
    unitCost: string | null;
    sellingPrice: string | null;
    active: boolean;
    onHand: number;
    /** In orders that are neither cancelled nor returned — already off on-hand, shown for context. */
    inOpenOrders: number;
  }>;
  listings: Array<{
    id: string;
    channel: string;
    externalId: string;
    externalVariantId: string;
    partnerSku: string | null;
    title: string | null;
    price: string | null;
    variantId: string;
  }>;
}

export const getOrders = (query = '') =>
  get<{ orders: OrderRow[]; total: number; limit: number; offset: number }>(
    `/orders${query ? `?${query}` : ''}`,
  );

export const getOrder = (id: string) => get<OrderDetail>(`/orders/${id}`);
export const getOrderSummary = () => get<OrderSummary>('/orders/summary');
export const getAssignees = () => get<Assignee[]>('/auth/users');
export const getProductsCatalog = (query?: string) =>
  get<ProductRow[]>(`/catalog/products${query ? (query.startsWith('?') ? query : `?${query}`) : ''}`);
export const getProductsSummary = (query?: string) =>
  get<ProductsSummary>(`/catalog/products/summary${query ? (query.startsWith('?') ? query : `?${query}`) : ''}`);
export const getProductDetail = (id: string) => get<ProductDetail>(`/catalog/products/${id}`);
export const getStockHistory = (variantId: string) =>
  get<Array<{ id: string; quantity: number; reason: string; note: string | null; occurredAt: string; runningTotal: number }>>(
    `/catalog/variants/${variantId}/stock`,
  );

export const getBostaShipments = () =>
  get<ShipmentTracking[]>('/bosta/shipments');

export const trackBostaShipment = (trackingNumber: string) =>
  get<ShipmentTracking>(`/bosta/track/${encodeURIComponent(trackingNumber)}`);

export const getOrderShipment = (orderId: string) =>
  get<ShipmentTracking | null>(`/bosta/orders/${orderId}`);

export interface FinanceOverview {
  /** Null until an opening balance anchor is set. */
  cash: string | null;
  stockValue: string;
  totalAssets: string | null;
  openingBalance: string;
  openingAsOf: string | null;
}

export type LedgerAccountKind = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export interface AccountBalance {
  code: string;
  nameAr: string;
  nameEn: string;
  kind: LedgerAccountKind;
  balance: string;
}

export interface LedgerRow {
  id: string;
  occurredAt: string;
  amount: string;
  kind: string;
  memo: string | null;
  debitCode: string;
  creditCode: string;
  debitAr: string;
  creditAr: string;
  supplierId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  reversesId: string | null;
  actorId: string | null;
}

/** A ledger row seen from one account: its signed effect and the balance after. */
export interface AccountLedgerRow extends LedgerRow {
  effect: string;
  runningBalance: string;
}

export interface ChequeRow {
  id: string;
  amount: string;
  fromParty: string;
  receivedDate: string;
  dueDate: string | null;
  status: 'PENDING' | 'CLEARED' | 'BOUNCED';
  clearedDate: string | null;
  memo: string | null;
  createdAt: string;
}

export const getFinanceOverview = () => get<FinanceOverview>('/finance/overview');
export const getMoneyAccounts = () => get<AccountBalance[]>('/finance/accounts');
export const getAccountLedger = (code: string, limit = 100) =>
  get<AccountLedgerRow[]>(`/finance/accounts/${code}/ledger?limit=${limit}`);
export const getLedger = (query = '') =>
  get<{ entries: LedgerRow[]; total: number; limit: number; offset: number }>(
    `/finance/ledger${query ? `?${query}` : ''}`,
  );
export const getCheques = (status?: string) =>
  get<ChequeRow[]>(`/finance/cheques${status ? `?status=${status}` : ''}`);



