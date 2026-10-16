import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ChannelListing } from '../catalog/channel-listing.entity';
import { AmazonImport } from './amazon-import.entity';

/**
 * One line of an Amazon transaction report, stored as Amazon wrote it. Every
 * Amazon figure on screen is a SUM over these rows; only `status`,
 * `releaseAt` and `settlementId` are refreshed by a later download.
 *
 * Money is `numeric(14,2)`, a string in TypeScript: arithmetic stays in Postgres.
 */
@Entity('amazon_transaction')
@Unique('uq_amazon_transaction_fingerprint', ['fingerprint'])
export class AmazonTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** SHA-256 of the line's unchanging cells and its copy number — the dedup key. */
  @Column({ type: 'text' })
  fingerprint: string;

  @ManyToOne(() => AmazonImport, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_id' })
  import: AmazonImport;

  @Column({ name: 'import_id', type: 'uuid' })
  importId: string;

  @Index('ix_amazon_tx_posted')
  @Column({ type: 'timestamptz' })
  postedAt: Date;

  @Column({ type: 'text', nullable: true })
  settlementId: string | null;

  @Column({ type: 'text' })
  type: string;

  @Index('ix_amazon_tx_order')
  @Column({ type: 'text', nullable: true })
  orderId: string | null;

  /** The seller SKU — `channel_listing.external_id` for Amazon. */
  @Column({ type: 'text', nullable: true })
  sku: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  marketplace: string | null;

  @Column({ type: 'text', nullable: true })
  fulfillment: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 }) productSales: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) shippingCredits: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) promotionalRebates: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) sellingFees: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) fbaFees: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) otherTransactionFees: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) other: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) total: string;

  /** `Released` | `Deferred` (Amazon still holds the money until `releaseAt`). */
  @Column({ type: 'text', nullable: true })
  status: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  releaseAt: Date | null;

  /**
   * The product it belongs to: by SKU for order and refund lines; a fee line
   * with an order id but no SKU takes its order's product when the order holds one.
   */
  @ManyToOne(() => ChannelListing, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'listing_id' })
  listing: ChannelListing | null;

  @Index('ix_amazon_tx_listing')
  @Column({ name: 'listing_id', type: 'uuid', nullable: true })
  listingId: string | null;
}
