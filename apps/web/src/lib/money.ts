import type { Tone } from '@/components/tone-badge';
import type { AccountBalance, LedgerRow } from '@/lib/api';
import type messages from '@/messages/en.json';

/** Plain-language label for every ledger entry kind, for the activity feed. */
export const KIND_LABEL: Record<string, string> = {
  OPENING_BALANCE: 'Opening balance',
  CASH_DEPOSIT: 'Cash deposit',
  CHEQUE_DEPOSIT: 'Cheque received',
  CHEQUE_CLEAR: 'Cheque cleared',
  CHEQUE_BOUNCE: 'Cheque bounced',
  PAYMENT_IN: 'Money in',
  PAYMENT_OUT: 'Payment',
  CAPITAL_WITHDRAWAL: 'Owner withdrawal',
  PURCHASE: 'Purchase',
  SUPPLIER_PAYMENT: 'Supplier payment',
  NOON_ACCRUAL: 'noon sale',
  NOON_FEE: 'noon fee',
  NOON_PAYOUT: 'noon payout',
  ORDER_SALE: 'Order paid',
  COGS: 'Cost of goods',
  BOSTA_PAYOUT: 'Bosta payout',
  RETURN: 'Return',
  STOCK_LOSS: 'Stock loss',
  ADJUSTMENT: 'Adjustment',
};

export const kindLabel = (kind: string) => KIND_LABEL[kind] ?? kind;

/** A kind the messages name (`enums.entryKind.*`) — anything newer shows as its code. */
export const isEntryKind = (kind: string): kind is keyof (typeof messages)['enums']['entryKind'] =>
  kind in KIND_LABEL;

/**
 * What one entry did to one account: positive when its balance grew, negative
 * when it shrank, null when the entry never touched it. Entries themselves are
 * never signed — they move a positive amount from one account to another — so
 * a sign only exists from an account's point of view. Same rule as the API's
 * `naturalBalance` (finance/ledger.service.ts).
 */
export function effectOn(
  e: Pick<LedgerRow, 'amount' | 'debitCode' | 'creditCode'>,
  account: Pick<AccountBalance, 'code' | 'kind'>,
): number | null {
  const side = e.debitCode === account.code ? 1 : e.creditCode === account.code ? -1 : 0;
  if (!side) return null;
  const debitGrows = account.kind === 'ASSET' || account.kind === 'EXPENSE';
  return Number(e.amount) * side * (debitGrows ? 1 : -1);
}

/** Where an entry came from, when that record has a screen of its own. */
const SOURCE_PATH: Record<string, string> = {
  order: '/orders/',
  purchase_invoice: '/money/purchases/',
  supplier: '/money/suppliers/',
};

export const sourceHref = (e: Pick<LedgerRow, 'sourceType' | 'sourceId'>) =>
  e.sourceType && e.sourceId && SOURCE_PATH[e.sourceType] ? SOURCE_PATH[e.sourceType] + e.sourceId : null;

/**
 * An entry's memo minus what its row already says. A reversal is written as
 * "Reversal — <original memo or kind>"; the row shows a Reversal badge and the
 * kind, so only an original memo is worth repeating.
 */
export function entryMemo(e: Pick<LedgerRow, 'memo' | 'kind' | 'reversesId'>): string | null {
  if (!e.memo || !e.reversesId) return e.memo;
  const original = e.memo.replace(/^Reversal — /, '');
  return original === e.kind ? null : original;
}

/**
 * Money moving into or out of the treasury, named by the account on the other
 * side — "Supplier payments" rather than "Supplier payable". Anything not
 * listed falls back to the account's own name.
 */
const FLOW_LABEL: Record<string, { in?: string; out?: string }> = {
  SALES: { in: 'Sales', out: 'Sales reversed' },
  OWNER_CAPITAL: { in: 'Owner deposits', out: 'Owner withdrawals' },
  SUPPLIER_PAYABLE: { in: 'Supplier refunds', out: 'Supplier payments' },
  INVENTORY: { in: 'Cash purchases reversed', out: 'Stock bought for cash' },
  OTHER_EXPENSE: { out: 'Expenses' },
  SHIPPING: { out: 'Shipping' },
  CHANNEL_FEES: { out: 'Fees and ads' },
  NOON_RECEIVABLE: { in: 'noon payouts' },
  AMAZON_RECEIVABLE: { in: 'Amazon payouts' },
  BOSTA_COD: { in: 'Bosta payouts' },
  CHEQUES_PENDING: { in: 'Cheques cleared' },
};

export const flowLabel = (direction: 'in' | 'out', code: string, fallback: string) =>
  FLOW_LABEL[code]?.[direction] ?? fallback;

/** How an invoice's paid state reads, and what it means. */
export const PAID_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  UNPAID: { label: 'Unpaid', tone: 'warning' },
  PARTIAL: { label: 'Partly paid', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
};

/** The counter-accounts a hand-entered voucher can move cash against. */
export const VOUCHER_COUNTERS = [
  { code: 'OTHER_EXPENSE', label: 'General expense' },
  { code: 'SHIPPING', label: 'Shipping' },
  { code: 'CHANNEL_FEES', label: 'Channel fees / ads' },
  { code: 'OWNER_CAPITAL', label: 'Owner capital' },
] as const;

/** Groups account balances the way the overview reads them. */
export function groupAccounts(accounts: AccountBalance[]) {
  const held = accounts.filter(
    (a) => a.kind === 'ASSET' && a.code !== 'INVENTORY',
  );
  const owe = accounts.filter((a) => a.kind === 'LIABILITY');
  const capital = accounts.filter((a) => a.kind === 'EQUITY');
  const performance = accounts.filter((a) => a.kind === 'INCOME' || a.kind === 'EXPENSE');
  return { held, owe, capital, performance };
}

export const accountByCode = (accounts: AccountBalance[], code: string) =>
  accounts.find((a) => a.code === code);

/**
 * Client-side preview of how extra costs land on each line. The server
 * (purchasing/costing.ts) is the source of truth on posting — this only needs
 * to be close enough to show the operator what they're about to commit.
 */
export function previewLanded(
  lines: Array<{ quantity: number; unitCost: number }>,
  extra: number,
  method: 'BY_VALUE' | 'PER_UNIT',
) {
  const withTotals = lines.map((l) => ({ ...l, lineTotal: l.quantity * l.unitCost }));
  const totalValue = withTotals.reduce((s, l) => s + l.lineTotal, 0);
  const totalUnits = withTotals.reduce((s, l) => s + l.quantity, 0);
  return withTotals.map((l) => {
    const basis =
      method === 'BY_VALUE'
        ? totalValue > 0
          ? l.lineTotal / totalValue
          : 0
        : totalUnits > 0
          ? l.quantity / totalUnits
          : 0;
    const landedLineTotal = l.lineTotal + extra * basis;
    return {
      lineTotal: l.lineTotal,
      landedUnitCost: l.quantity > 0 ? landedLineTotal / l.quantity : 0,
    };
  });
}
