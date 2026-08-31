import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * The anchor cash balance was true at, before the ledger started recording
 * events. Same shape and same reason as ChannelAccount for noon: money that
 * moved before we started tracking can't be replayed, so it has to be a
 * starting number rather than reconstructed from history.
 *
 * A single row (id='default') — one business, one cash position, today.
 */
@Entity('cash_account')
export class CashAccount {
  @PrimaryColumn({ type: 'text', default: 'default' })
  id: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  openingBalance: string;

  @Column({ type: 'date', nullable: true })
  openingAsOf: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
