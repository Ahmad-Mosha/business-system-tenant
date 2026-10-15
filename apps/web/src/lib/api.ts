/**
 * Every read the screens make: typed API calls for server components. A
 * failed read throws, and the screen's error boundary takes over. Writes go
 * through server actions and `api-request.ts`, which answer with a result
 * instead of throwing, so a form can say what went wrong.
 */
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
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUND_DUE' | 'REFUNDED';

export interface OrderRow {
  id: string;
  orderNumber: string;
  source: 'EASYORDERS' | 'SOCIAL';
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'COD' | 'WALLET' | 'INSTAPAY';
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
  /** Why its items and prices can't be edited right now, from the API's own rule. */
  blocked?: { edit: import('@/lib/problem').Reason[] };
  address: string | null;
  notes: string | null;
  subtotal: string;
  shippingCost: string;
  externalId: string | null;
  externalStatus: string | null;
  /** Changes on every save — an unsaved edit draft remembers which version it began from. */
  updatedAt: string;
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
  /** What those delivered, unpaid orders still owe. */
  deliveredUnpaidAmount: string;
  byStatus: Record<OrderStatus, number>;
}

export interface Assignee {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MODERATOR';
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  active: boolean;
  assigned: number;
  delivered: number;
  cancelled: number;
  deliveredValue: string;
  /** delivered ÷ assigned, %, or null when they have no orders yet. */
  deliveryRate: number | null;
}

export interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  discovered: boolean;
  active: boolean;
  variantCount: number;
  onHand: number;
  stockValue: string;
  warehouseOnHand: number;
  noonOnHand: number;
  /** Units already off on-hand but sitting in an order that hasn't shipped,
   *  delivered or reversed — context, not a second pool of stock. */
  inOrders: number;
  /** Inventory (valuation) cost per piece: moving average incl. shipping/customs — not a purchase price. */
  unitCost: string | null;
  sellingPrice: string | null;
  channels: string[];
  /** What the supplier charged per piece on posted invoices (before shipping). Null with no purchase history. */
  lastPurchasePrice: string | null;
  lastPurchaseDate: string | null;
  lastPurchaseSupplier: string | null;
  avgPurchasePrice: string | null;
  purchasedUnits: number | null;
  purchaseInvoices: number | null;
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
  /** False once archived. */
  active: boolean;
  draftPurchases: number;
  /** Nothing anywhere refers to it, so it can be deleted rather than archived. */
  deletable: boolean;
  /** What stands in the way of deleting or archiving it, from the API's own rules. */
  blocked?: { delete: import('@/lib/problem').Reason[]; archive: import('@/lib/problem').Reason[] };
  lastPurchasePrice: string | null;
  lastPurchaseDate: string | null;
  lastPurchaseSupplier: string | null;
  avgPurchasePrice: string | null;
  purchasedUnits: number | null;
  purchaseInvoices: number | null;
  /** The latest posted purchases, newest first. */
  purchases: Array<{
    invoiceId: string;
    invoiceNo: string | null;
    invoiceDate: string;
    supplier: string;
    variantId: string;
    quantity: number;
    unitCost: string;
    landedUnitCost: string | null;
    lineTotal: string;
  }>;
  variants: Array<{
    id: string;
    name: string;
    sku: string | null;
    attributes: Record<string, string>;
    unitCost: string | null;
    sellingPrice: string | null;
    active: boolean;
    onHand: number;
    warehouseOnHand: number;
    noonOnHand: number;
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
export const getOrderSummary = (query = '') => get<OrderSummary>(`/orders/summary${query ? `?${query}` : ''}`);
export const getAssignees = () => get<Assignee[]>('/auth/users');
export const getTeam = () => get<TeamMember[]>('/auth/team');
export const getProductsCatalog = (query?: string) =>
  get<ProductRow[]>(`/catalog/products${query ? (query.startsWith('?') ? query : `?${query}`) : ''}`);
export const getProductsSummary = (query?: string) =>
  get<ProductsSummary>(`/catalog/products/summary${query ? (query.startsWith('?') ? query : `?${query}`) : ''}`);
export const getProductDetail = (id: string) => get<ProductDetail>(`/catalog/products/${id}`);
export const getStockHistory = (variantId: string) =>
  get<Array<{ id: string; quantity: number; reason: string; location: 'WAREHOUSE' | 'NOON'; note: string | null; occurredAt: string; runningTotal: number }>>(
    `/catalog/variants/${variantId}/stock`,
  );

export const getBostaShipments = () =>
  get<ShipmentTracking[]>('/bosta/shipments');

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
  /** Set when the entry was cancelled: when, by whom and why (read off its reversal). */
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  /** On a corrected voucher: the entry it replaced. */
  replacesId?: string | null;
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
export const getAccountLedger = (code: string, limit = 100, cancelled = false) =>
  get<AccountLedgerRow[]>(`/finance/accounts/${code}/ledger?limit=${limit}${cancelled ? '&cancelled=1' : ''}`);
export const getLedger = (query = '') =>
  get<{ entries: LedgerRow[]; total: number; limit: number; offset: number }>(
    `/finance/ledger${query ? `?${query}` : ''}`,
  );
export const getCheques = (status?: string) =>
  get<ChequeRow[]>(`/finance/cheques${status ? `?status=${status}` : ''}`);

export interface SupplierRow {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  active: boolean;
  balance: string;
  createdAt: string;
}

export type PaidStatus = 'DRAFT' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'VOID';

export interface PurchaseInvoiceRow {
  id: string;
  invoiceNo: string | null;
  invoiceDate: string;
  status: 'DRAFT' | 'POSTED' | 'VOID';
  payment: 'CASH' | 'CREDIT';
  goodsTotal: string;
  extraCosts: string;
  landedTotal: string;
  settledAmount: string;
  payableTotal: string;
  paidStatus: PaidStatus;
  postedAt: string | null;
  supplierName: string;
  lineCount: number;
}

export interface SupplierDetail extends SupplierRow {
  /** What stands in the way of deleting or archiving it, from the API's own rules. */
  blocked?: { delete: import('@/lib/problem').Reason[]; archive: import('@/lib/problem').Reason[] };
  invoices: PurchaseInvoiceRow[];
  payments: LedgerRow[];
}

export interface PurchaseInvoiceLine {
  id: string;
  variantId: string;
  quantity: number;
  unitCost: string;
  landedUnitCost: string | null;
  lineTotal: string;
  label: string;
}

export interface PurchaseInvoiceDetail {
  id: string;
  supplierId: string;
  supplier: { id: string; name: string; phone: string | null };
  invoiceNo: string | null;
  invoiceDate: string;
  status: 'DRAFT' | 'POSTED' | 'VOID';
  payment: 'CASH' | 'CREDIT';
  allocation: 'BY_VALUE' | 'PER_UNIT';
  extraCostsPaidSeparately: boolean;
  goodsTotal: string;
  extraCosts: string;
  landedTotal: string;
  settledAmount: string;
  payableTotal: string;
  paidStatus: PaidStatus;
  postedAt: string | null;
  /** Changes on every save — a local edit draft remembers which version it began from. */
  updatedAt: string;
  lines: PurchaseInvoiceLine[];
  /** Why, when and by whom it was cancelled; the draft that re-enters it, if any. */
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  replacedById: string | null;
  /** On a correction draft: the cancelled invoice it re-enters. */
  replacesId: string | null;
  /** What stands in the way of cancelling or editing it, from the API's own rules. */
  blocked?: { cancel: import('@/lib/problem').Reason[] };
}

export interface PeriodSummary {
  revenue: string;
  cogs: string;
  channelFees: string;
  shipping: string;
  otherExpense: string;
}

export const getCashSeries = (days = 90) =>
  get<Array<{ date: string; balance: string }>>(`/finance/cash-series?days=${days}`);
export const getPeriodSummary = (from?: string, to?: string) =>
  get<PeriodSummary>(`/finance/summary${from && to ? `?from=${from}&to=${to}` : ''}`);

export interface BusinessProfitReport {
  sales: string;
  shipping: string;
  businessProfit: string;
  unreconciledEntries: number;
  series: Array<{ period: string; sales: string; shipping: string; businessProfit: string }>;
}
export const getBusinessProfit = (from: string, to: string, bucket: 'day' | 'week' | 'month') =>
  get<BusinessProfitReport>(`/finance/business-profit?from=${from}&to=${to}&bucket=${bucket}`);

/** Money into and out of the treasury between two dates — per bucket, and by where. */
export interface CashFlow {
  series: Array<{ period: string; in: string; out: string }>;
  sources: Array<{ direction: 'in' | 'out'; code: string; nameEn: string; nameAr: string; amount: string }>;
}

export const getCashFlow = (from: string, to: string, bucket: 'day' | 'week' | 'month') =>
  get<CashFlow>(`/finance/cash-flow?from=${from}&to=${to}&bucket=${bucket}`);

export const getSuppliers = (archived = false) =>
  get<SupplierRow[]>(archived ? '/suppliers?status=archived' : '/suppliers');
export const getSupplier = (id: string, cancelled = false) =>
  get<SupplierDetail>(`/suppliers/${id}${cancelled ? '?cancelled=1' : ''}`);
export const getPurchases = (cancelled = false) => get<PurchaseInvoiceRow[]>(`/purchases${cancelled ? '?cancelled=1' : ''}`);
export const getPurchase = (id: string) => get<PurchaseInvoiceDetail>(`/purchases/${id}`);


export const getExpenseCategories = () => get<Array<{ id: string; name: string }>>('/expenses/categories');
export const getExpenses = (query: string) => get<{
  expenses: Array<{
    id: string; amount: string; spentOn: string; note: string | null; category: string;
    voidedAt: string | null; voidReason: string | null; voidedBy: string | null;
    /** A correction points at what it replaced; a corrected one at its replacement. */
    replacesId: string | null; replacedById: string | null;
  }>;
  total: number; totalAmount: string; page: number;
  /** How many voided expenses the filters hide. */
  cancelled: number;
}>(`/expenses?${query}`);

// ── Sales ────────────────────────────────────────────────────────────────

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  active: boolean;
  /** Unpaid remainder of their posted invoices. */
  balance: string;
  createdAt: string;
  /** Their posted invoices: how much, how many, and the latest date (null before the first). */
  sold?: string;
  invoiceCount?: number;
  lastInvoiceAt?: string | null;
}

export type SalesInvoiceStatus = 'DRAFT' | 'POSTED' | 'VOID';

export interface SalesInvoiceRow {
  id: string;
  /** Given when posted; null for a draft. */
  invoiceNumber: string | null;
  invoiceDate: string;
  status: SalesInvoiceStatus;
  goodsTotal: string;
  discount: string;
  total: string;
  paidAmount: string;
  customerId: string;
  customerName: string;
  updatedAt: string;
  lineCount: number;
}

export interface CustomerDetail extends CustomerRow {
  blocked?: { delete: import('@/lib/problem').Reason[]; archive: import('@/lib/problem').Reason[] };
  invoices: SalesInvoiceRow[];
}

export interface SalesInvoiceLine {
  id: string;
  variantId: string;
  label: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  /** Inventory cost per piece frozen when posted; null on a draft. */
  unitCost: string | null;
  /** Today's inventory cost — what a draft would book. */
  currentCost: string | null;
  /** Warehouse stock now. */
  onHand: number;
}

export interface SalesInvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  status: SalesInvoiceStatus;
  customerId: string;
  customer: { id: string; name: string; phone: string | null };
  goodsTotal: string;
  discount: string;
  total: string;
  paidAmount: string;
  notes: string | null;
  postedAt: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  updatedAt: string;
  lines: SalesInvoiceLine[];
  /** Money received against it; a reversed one stays listed, marked. */
  payments: SalesPayment[];
  /** What stands in the way of posting or voiding it, from the API's own rules. */
  blocked?: { post: import('@/lib/problem').Reason[]; void: import('@/lib/problem').Reason[] };
}

export interface SalesPayment {
  id: string;
  amount: string;
  occurredAt: string;
  memo: string | null;
  reversed: boolean;
}

export const getCustomers = (archived = false) =>
  get<CustomerRow[]>(archived ? '/customers?status=archived' : '/customers');
export const getCustomer = (id: string) => get<CustomerDetail>(`/customers/${id}`);
export const getSalesInvoices = (cancelled = false) =>
  get<SalesInvoiceRow[]>(`/sales-invoices${cancelled ? '?cancelled=1' : ''}`);
export const getSalesInvoice = (id: string) => get<SalesInvoiceDetail>(`/sales-invoices/${id}`);
