import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ChannelListing } from '../catalog/channel-listing.entity';
import { NoonImport } from './noon-import.entity';

/**
 * One line of a noon settlement export, stored verbatim and never mutated.
 *
 * This is the source of truth for what noon says it owes us. Every reported
 * figure is a SUM over these rows, so a number on a dashboard can always be
 * traced to the lines that produced it.
 *
 * Money is `numeric(14,2)` and surfaces in TypeScript as a string on purpose:
 * all arithmetic happens in Postgres, so nothing is ever routed through a float.
 */
@Entity('noon_transaction')
@Unique('uq_noon_transaction_fingerprint', ['fingerprint'])
@Index('ix_noon_tx_type_date', ['transactionType', 'transactionDate'])
export class NoonTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** SHA-256 of the raw CSV line — the idempotency key for row-level dedup. */
  @Column({ type: 'text' })
  fingerprint: string;

  @ManyToOne(() => NoonImport, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_id' })
  import: NoonImport;

  @Column({ name: 'import_id', type: 'uuid' })
  importId: string;

  /** Settlement period, e.g. `PS-346654-EG20260729`, or a bank-transfer label. */
  @Index('ix_noon_tx_reference')
  @Column({ type: 'text' })
  referenceNr: string;

  @Column({ type: 'text', nullable: true })
  orderNr: string | null;

  /**
   * `<orderNr>-<lineIndex>`. noon ships no quantity column: one row is one
   * unit, so quantity is a COUNT of rows, never a stored field.
   */
  @Column({ type: 'text', nullable: true })
  itemNr: string | null;

  @Column({ type: 'date', nullable: true })
  orderDate: string | null;

  @Index('ix_noon_tx_date')
  @Column({ type: 'date', nullable: true })
  transactionDate: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  noonSku: string | null;

  @Column({ type: 'text', nullable: true })
  partnerSku: string | null;

  /** `order` | `order_update` | `payment` | `statement_fee` | `balance_transfer`. */
  @Column({ type: 'text' })
  transactionType: string;

  @Column({ type: 'text', default: 'EGP' })
  currency: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 }) netProceeds: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) referralFee: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) fulfilmentFee: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) shippingCredits: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) otherOrderFees: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) orderSubsidies: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) nonOrderFees: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) nonOrderSubsidies: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) others: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) total: string;

  /**
   * Resolved from `partnerSku` at import time. Null for the ~8% of rows that
   * carry no product at all: payouts, advertising fees, shipping-only lines.
   */
  @ManyToOne(() => ChannelListing, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'listing_id' })
  listing: ChannelListing | null;

  @Index('ix_noon_tx_listing')
  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId: string | null;
}
