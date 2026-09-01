import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The fixed chart of accounts for the money module. Seeded on boot and never
 * edited through the app — an "account" here is just a named place value sits,
 * and every money figure in the system (cash, stock value, what noon owes us,
 * profit) is a SUM of `ledger_entry` rows against one of these codes.
 *
 * `kind` decides how a balance reads:
 *   ASSET / EXPENSE            → SUM(debits) − SUM(credits)
 *   LIABILITY / EQUITY / INCOME → SUM(credits) − SUM(debits)
 */
export const LEDGER_ACCOUNT_KINDS = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const;
export type LedgerAccountKind = (typeof LEDGER_ACCOUNT_KINDS)[number];

@Entity('ledger_account')
export class LedgerAccount {
  /** Stable identifier used everywhere in code, e.g. `CASH`, `INVENTORY`. */
  @PrimaryColumn({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  nameAr: string;

  @Column({ type: 'text' })
  nameEn: string;

  @Column({ type: 'text' })
  kind: LedgerAccountKind;

  /** Display order in the interface. */
  @Column({ type: 'int', default: 0 })
  sort: number;
}

export interface LedgerAccountSeed {
  code: string;
  nameAr: string;
  nameEn: string;
  kind: LedgerAccountKind;
}

/**
 * The complete set. Array order is the display order. Adding a row here and
 * restarting is the only supported way to gain an account.
 */
export const LEDGER_ACCOUNTS = [
  { code: 'CASH', nameAr: 'الخزينة', nameEn: 'Cash', kind: 'ASSET' },
  { code: 'CHEQUES_PENDING', nameAr: 'شيكات برسم التحصيل', nameEn: 'Cheques pending', kind: 'ASSET' },
  { code: 'INVENTORY', nameAr: 'المخزون', nameEn: 'Inventory', kind: 'ASSET' },
  { code: 'NOON_RECEIVABLE', nameAr: 'رصيد نون', nameEn: 'noon balance', kind: 'ASSET' },
  { code: 'AMAZON_RECEIVABLE', nameAr: 'رصيد أمازون', nameEn: 'Amazon balance', kind: 'ASSET' },
  { code: 'BOSTA_COD', nameAr: 'تحصيلات بوسطة', nameEn: 'Bosta holding', kind: 'ASSET' },
  { code: 'SUPPLIER_PAYABLE', nameAr: 'مستحقات الموردين', nameEn: 'Supplier payable', kind: 'LIABILITY' },
  { code: 'OWNER_CAPITAL', nameAr: 'رأس المال', nameEn: 'Owner capital', kind: 'EQUITY' },
  { code: 'OPENING_EQUITY', nameAr: 'رصيد افتتاحي', nameEn: 'Opening balance', kind: 'EQUITY' },
  { code: 'SALES', nameAr: 'المبيعات', nameEn: 'Sales revenue', kind: 'INCOME' },
  { code: 'COGS', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'Cost of goods sold', kind: 'EXPENSE' },
  { code: 'CHANNEL_FEES', nameAr: 'عمولات ورسوم القنوات', nameEn: 'Channel fees', kind: 'EXPENSE' },
  { code: 'SHIPPING', nameAr: 'مصاريف الشحن', nameEn: 'Shipping', kind: 'EXPENSE' },
  { code: 'OTHER_EXPENSE', nameAr: 'مصروفات أخرى', nameEn: 'Other expenses', kind: 'EXPENSE' },
] as const satisfies readonly LedgerAccountSeed[];

/** A code that is known at compile time — every posting names two of these. */
export type LedgerAccountCode = (typeof LEDGER_ACCOUNTS)[number]['code'];
