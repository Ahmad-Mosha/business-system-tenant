import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LedgerAccount } from './ledger-account.entity';

/**
 * Why an entry exists. Not a category the user picks — it is set by whatever
 * recorded the entry (a voucher form, a purchase invoice, an import), and it
 * is what the activity feed reads to label a row in plain language.
 */
export type LedgerEntryKind =
  | 'OPENING_BALANCE' // the anchor figure the ledger starts from
  | 'CASH_DEPOSIT' // إيداع نقدي — owner puts cash in
  | 'CHEQUE_DEPOSIT' // إيداع سندي — a cheque received, not yet cleared
  | 'CHEQUE_CLEAR' // that cheque cleared into cash
  | 'CHEQUE_BOUNCE' // …or it bounced
  | 'PAYMENT_IN' // سند قبض — money in for any other reason
  | 'PAYMENT_OUT' // سند صرف — an expense paid from cash
  | 'CAPITAL_WITHDRAWAL' // an owner takes money out
  | 'PURCHASE' // a purchase invoice posted
  | 'SUPPLIER_PAYMENT' // paid a supplier what we owed
  | 'NOON_ACCRUAL' // a noon sale: what noon now owes us
  | 'NOON_FEE' // noon's commission / fulfilment / ads on a settlement
  | 'NOON_PAYOUT' // noon transferred money to our bank
  | 'ORDER_SALE' // a website / social order delivered
  | 'COGS' // cost of the goods on a sale
  | 'BOSTA_PAYOUT' // Bosta transferred collected COD to us
  | 'RETURN' // a sale reversed
  | 'STOCK_LOSS' // damage or a short count written off
  | 'ADJUSTMENT'; // a manual correction

/**
 * One balanced movement of value: `amount` (always positive) leaves the
 * `credit` account and enters the `debit` account. Every money figure in the
 * system is a SUM over these rows — nothing is stored as a total, and a
 * mistake is fixed with a reversing entry, never an edit.
 *
 * Deliberately two-account, not a multi-line journal: every real event here is
 * expressible as exactly one from → one to, and that keeps the table something
 * a non-accountant can read.
 */
@Entity('ledger_entry')
@Index('ix_ledger_entry_occurred', ['occurredAt'])
@Index('ix_ledger_entry_debit', ['debitCode'])
@Index('ix_ledger_entry_credit', ['creditCode'])
@Index('ix_ledger_entry_source', ['sourceType', 'sourceId'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** When it happened in the business, which may predate when it was recorded. */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  occurredAt: Date;

  /** Always > 0. Direction is carried by the two account codes, never a sign. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @ManyToOne(() => LedgerAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'debit_code' })
  debit: LedgerAccount;

  @Column({ name: 'debit_code', type: 'text' })
  debitCode: string;

  @ManyToOne(() => LedgerAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'credit_code' })
  credit: LedgerAccount;

  @Column({ name: 'credit_code', type: 'text' })
  creditCode: string;

  @Column({ type: 'text' })
  kind: LedgerEntryKind;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  /** Set whenever `SUPPLIER_PAYABLE` is one of the accounts, so per-supplier balances resolve. */
  @Index('ix_ledger_entry_supplier')
  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  /** What produced this — `purchase_invoice`, `noon_transaction`, `order`, `cheque`, `manual`. */
  @Column({ type: 'text', nullable: true })
  sourceType: string | null;

  @Column({ type: 'text', nullable: true })
  sourceId: string | null;

  /** A correcting entry points at the entry it undoes. */
  @Column({ name: 'reverses_id', type: 'uuid', nullable: true })
  reversesId: string | null;

  /** Null for automatic entries (an import, an order flow); set for hand-entered ones. */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
