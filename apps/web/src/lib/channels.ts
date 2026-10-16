/**
 * noon and Amazon, read into one shape so their screens are the same screens.
 * Each marketplace keeps its own report and its own words (`channel.lines.*`);
 * what differs is mapped here, once.
 */
import {
  getAccount,
  getAmazonAccount,
  getAmazonImports,
  getAmazonPeriods,
  getAmazonProducts,
  getAmazonStatement,
  getAmazonUnattributed,
  getImports,
  getPeriods,
  getProducts,
  getStatement,
  getUnattributed,
  type ChannelAccount,
} from './api';

export type Marketplace = 'noon' | 'amazon';
export const MARKETPLACES: readonly Marketplace[] = ['noon', 'amazon'];

/** Where each marketplace's screens live. noon came first and kept the root. */
export const channelPath = (channel: Marketplace, screen: '' | 'products' | 'imports' = '') =>
  channel === 'noon' ? `/${screen}` : `/amazon${screen ? `/${screen}` : ''}`;

/** Every statement line either marketplace writes (`channel.lines.*`). */
export type LineKey =
  | 'netProceeds' | 'sales' | 'refunds'
  | 'referralFee' | 'fulfilmentFee' | 'shippingCredits' | 'otherOrderFees' | 'orderSubsidies' | 'advertisingFee' | 'advertisingSubsidy'
  | 'sellingFees' | 'shippingCharges' | 'serviceFees' | 'adjustments' | 'other';

export interface Line {
  key: LineKey;
  amount: number;
}

/** Lines no product owns, by the marketplace's own type (`channel.unattributed.types.*`). */
export const UNATTRIBUTED_TYPES = [
  'order', 'order_update', 'statement_fee', 'balance_transfer',
  'Order', 'Refund', 'Amazon Fees', 'Service Fee', 'Adjustment',
] as const;

export interface ChannelStatement {
  /** What customers paid, line by line (Amazon splits out refunds). */
  income: Line[];
  incomeTotal: number;
  /** The marketplace's cut and charges — only the lines that moved. */
  fees: Line[];
  feesTotal: number;
  net: number;
  /** Transfers to our bank: negative, money leaving the marketplace. */
  payouts: number;
  /** What the period added to the balance the marketplace owes. */
  movement: number;
  opening: number | null;
  closing: number | null;
  /** Amazon only: money earned but not yet released. */
  held: number;
  heldUntil: string | null;
  unitsSold: number;
  unitsReturned: number;
  rows: number;
}

export interface ChannelPeriod {
  month: string;
  from: string;
  to: string;
  income: number;
  fees: number;
  payouts: number;
  movement: number;
  unitsSold: number;
  closing: number | null;
}

export interface ChannelProduct {
  productId: string;
  name: string;
  unitsSold: number;
  unitsReturned: number;
  sales: number;
  fees: number;
  net: number;
  grossProfit: number | null;
  unitCost: string | null;
}

export interface ChannelUnattributed {
  type: string;
  rows: number;
  total: number;
}

export interface ChannelImport {
  id: string;
  filename: string;
  rowsInFile: number;
  rowsInserted: number;
  rowsSkipped: number;
  rowsUpdated: number | null;
  unmappedListings: number;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

const lines = (entries: Array<[LineKey, string | number]>): Line[] =>
  entries.map(([key, v]) => ({ key, amount: Number(v) })).filter((l) => Math.abs(l.amount) >= 0.005);
const orNull = (v: string | null) => (v === null ? null : Number(v));

export async function getChannelStatement(channel: Marketplace, from: string, to: string): Promise<ChannelStatement> {
  if (channel === 'amazon') {
    const s = await getAmazonStatement(from, to);
    return {
      income: lines([['sales', s.sales], ['refunds', s.refunds]]),
      incomeTotal: Number(s.income),
      fees: lines([['sellingFees', s.sellingFees], ['shippingCharges', s.shippingCharges], ['serviceFees', s.serviceFees], ['adjustments', s.adjustments], ['other', s.other]]),
      feesTotal: Number(s.fees),
      net: Number(s.net),
      payouts: Number(s.payouts),
      movement: Number(s.movement),
      opening: orNull(s.openingBalance),
      closing: orNull(s.closingBalance),
      held: Number(s.held),
      heldUntil: s.heldUntil,
      unitsSold: s.unitsSold,
      unitsReturned: s.unitsRefunded,
      rows: s.rows,
    };
  }
  const s = await getStatement(from, to);
  return {
    income: lines([['netProceeds', s.netProceeds]]),
    incomeTotal: Number(s.netProceeds),
    fees: lines([
      ['referralFee', s.referralFee], ['fulfilmentFee', s.fulfilmentFee], ['shippingCredits', s.shippingCredits],
      ['otherOrderFees', s.otherOrderFees], ['orderSubsidies', s.orderSubsidies],
      ['advertisingFee', s.advertisingFee], ['advertisingSubsidy', s.advertisingSubsidy],
    ]),
    feesTotal: Number(s.fees),
    net: Number(s.netProceeds) + Number(s.fees),
    payouts: Number(s.payouts),
    movement: Number(s.movement),
    opening: orNull(s.openingBalance),
    closing: orNull(s.closingBalance),
    held: 0,
    heldUntil: null,
    unitsSold: s.unitsSold,
    unitsReturned: s.unitsReturned,
    rows: s.rows,
  };
}

export async function getChannelPeriods(channel: Marketplace): Promise<ChannelPeriod[]> {
  const rows = channel === 'amazon'
    ? (await getAmazonPeriods()).map((p) => ({ ...p, income: p.income }))
    : (await getPeriods()).map((p) => ({ ...p, income: p.netProceeds }));
  return rows.map((p) => ({
    month: p.month,
    from: p.from,
    to: p.to,
    income: Number(p.income),
    fees: Number(p.fees),
    payouts: Number(p.payouts),
    movement: Number(p.movement),
    unitsSold: p.unitsSold,
    closing: orNull(p.closingBalance),
  }));
}

export async function getChannelProducts(channel: Marketplace, from: string, to: string): Promise<ChannelProduct[]> {
  if (channel === 'amazon') {
    return (await getAmazonProducts(from, to)).map((p) => ({
      productId: p.productId, name: p.name, unitsSold: p.unitsSold, unitsReturned: p.unitsReturned,
      sales: Number(p.income), fees: Number(p.fees), net: Number(p.net), grossProfit: orNull(p.grossProfit), unitCost: p.unitCost,
    }));
  }
  return (await getProducts(from, to)).map((p) => ({
    productId: p.productId, name: p.name, unitsSold: p.unitsSold, unitsReturned: p.unitsReturned,
    sales: Number(p.netProceeds), fees: Number(p.referralFee) + Number(p.fulfilmentFee) + Number(p.otherFees),
    net: Number(p.net), grossProfit: orNull(p.grossProfit), unitCost: p.unitCost,
  }));
}

/** Lines no product owns. Transfers are left out: the statement shows them as their own line. */
export async function getChannelUnattributed(channel: Marketplace, from: string, to: string): Promise<ChannelUnattributed[]> {
  const rows = channel === 'amazon' ? await getAmazonUnattributed(from, to) : await getUnattributed(from, to);
  return rows
    .filter((r) => r.transactionType !== 'payment' && r.transactionType !== 'Transfer')
    .map((r) => ({ type: r.transactionType, rows: r.rows, total: Number(r.total) }));
}

export async function getChannelImports(channel: Marketplace): Promise<ChannelImport[]> {
  if (channel === 'amazon') return getAmazonImports();
  return (await getImports()).map((i) => ({ ...i, rowsUpdated: null }));
}

export const getChannelAccount = (channel: Marketplace): Promise<ChannelAccount> =>
  channel === 'amazon' ? getAmazonAccount() : getAccount();

/** Everything we hold for a marketplace, as Cairo days; null before its first upload. */
export async function getChannelRange(channel: Marketplace): Promise<{ from: string; to: string } | null> {
  const imports = await getChannelImports(channel);
  const starts = imports.map((i) => i.periodStart).filter((d): d is string => !!d).sort();
  const ends = imports.map((i) => i.periodEnd).filter((d): d is string => !!d).sort();
  return starts.length && ends.length ? { from: starts[0], to: ends[ends.length - 1] } : null;
}
