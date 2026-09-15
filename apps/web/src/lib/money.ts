import type { Tone } from '@/components/tone-badge';
import type { AccountBalance, LedgerRow } from '@/lib/api';
import { isOneOf } from '@/lib/utils';
import { languageOf } from '@/i18n/config';

/** Every ledger entry kind the messages name (`enums.entryKind`) — a newer one shows as its code. */
const ENTRY_KINDS = [
  'OPENING_BALANCE',
  'CASH_DEPOSIT',
  'CHEQUE_DEPOSIT',
  'CHEQUE_CLEAR',
  'CHEQUE_BOUNCE',
  'PAYMENT_IN',
  'PAYMENT_OUT',
  'CAPITAL_WITHDRAWAL',
  'PURCHASE',
  'SUPPLIER_PAYMENT',
  'NOON_ACCRUAL',
  'NOON_FEE',
  'NOON_PAYOUT',
  'ORDER_SALE',
  'COGS',
  'BOSTA_PAYOUT',
  'RETURN',
  'STOCK_LOSS',
  'ADJUSTMENT',
] as const;

export const isEntryKind = (kind: string) => isOneOf(ENTRY_KINDS, kind);

/** An account's name in the reader's language — the API holds both (docs/i18n.md). */
export const accountName = (account: { nameAr: string; nameEn: string }, locale: string) =>
  languageOf(locale) === 'ar' ? account.nameAr : account.nameEn;

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
 * The memos the API writes itself (purchasing and finance services), in its
 * own English. The row already names the kind, so only the data inside is
 * worth showing: a supplier, an invoice number, who a cheque is from.
 */
const SYSTEM_MEMO = /^(?:Opening cash balance|Payment to (.+)|Purchase invoice ?(.*)|Cheque from (.+?)(?: cleared)?)$/;

export const isSystemMemo = (memo: string) => SYSTEM_MEMO.test(memo);

/**
 * An entry's memo minus what its row already says. A reversal is written as
 * "Reversal — <original memo or kind>"; the row shows a Reversal badge and the
 * kind. A memo a person typed is shown as they typed it.
 */
export function entryMemo(e: Pick<LedgerRow, 'memo' | 'kind' | 'reversesId'>): string | null {
  if (!e.memo) return null;
  const memo = e.reversesId ? e.memo.replace(/^Reversal — /, '') : e.memo;
  if (memo === e.kind) return null;
  const system = memo.match(SYSTEM_MEMO);
  return system ? system.slice(1).find(Boolean) || null : memo;
}

/**
 * Money moving into or out of the treasury, named by the account on the other
 * side — "Supplier payments" rather than "Supplier payable" (`enums.cashIn` /
 * `enums.cashOut`). Anything not listed goes by the account's own name.
 */
export const CASH_IN = [
  'SALES',
  'OWNER_CAPITAL',
  'SUPPLIER_PAYABLE',
  'INVENTORY',
  'NOON_RECEIVABLE',
  'AMAZON_RECEIVABLE',
  'BOSTA_COD',
  'CHEQUES_PENDING',
] as const;
export const CASH_OUT = [
  'SALES',
  'OWNER_CAPITAL',
  'SUPPLIER_PAYABLE',
  'INVENTORY',
  'OTHER_EXPENSE',
  'SHIPPING',
  'CHANNEL_FEES',
] as const;

/** How an invoice's paid state looks; its name is `enums.paidStatus`. */
export const PAID_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  UNPAID: 'warning',
  PARTIAL: 'warning',
  PAID: 'success',
};

/** The counter-accounts a hand-entered voucher can move cash against (`enums.voucherCounter`). */
export const VOUCHER_COUNTERS = ['OTHER_EXPENSE', 'SHIPPING', 'CHANNEL_FEES', 'OWNER_CAPITAL'] as const;

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
