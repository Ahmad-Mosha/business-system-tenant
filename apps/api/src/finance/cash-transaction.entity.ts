import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type CashReason =
  | 'CAPITAL_INJECTION' // owner adds funds
  | 'CAPITAL_WITHDRAWAL' // owner takes funds out
  | 'PURCHASE' // stock bought — cash converts to inventory
  | 'NOON_PAYOUT' // a real noon bank transfer landed
  | 'ORDER_PAYMENT' // an order (website/social) was collected
  | 'ADJUSTMENT'; // manual correction

/**
 * Cash, the same way stock is: an append-only ledger, never a mutable
 * counter. Balance is `SUM(amount)` from the anchor forward — see
 * CashAccount — so "why is cash X" always has an answer in these rows.
 *
 * Confirmed scope for now (2026-08): purchases are the only automatic
 * outflow; real money arriving (noon payouts, an order marked paid) is the
 * only automatic inflow. Shipping, ads, salaries — deliberately not wired
 * yet, per the business decision to ship this foundation first.
 */
@Entity('cash_transaction')
@Index('ix_cash_tx_occurred', ['occurredAt'])
export class CashTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Signed: positive is cash in, negative is cash out. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'text' })
  reason: CashReason;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** What caused this — a stock_movement id, a noon_transaction id, an order id. */
  @Column({ type: 'text', nullable: true })
  sourceType: string | null;

  @Column({ type: 'text', nullable: true })
  sourceId: string | null;

  /** Null for automatic entries (a purchase, a payout) — only manual ones have an actor. */
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  occurredAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
