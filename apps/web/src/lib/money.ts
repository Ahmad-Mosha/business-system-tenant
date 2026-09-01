import type { AccountBalance } from '@/lib/api';

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

/** How an invoice's paid state reads, and its chip colour. */
export const PAID_STATUS: Record<
  string,
  { label: string; tone: 'ok' | 'warn' | 'muted' }
> = {
  DRAFT: { label: 'Draft', tone: 'warn' },
  UNPAID: { label: 'Unpaid', tone: 'warn' },
  PARTIAL: { label: 'Partly paid', tone: 'warn' },
  PAID: { label: 'Paid', tone: 'ok' },
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
