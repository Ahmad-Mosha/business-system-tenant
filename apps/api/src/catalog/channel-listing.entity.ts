import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ProductVariant } from './product-variant.entity';

export type Channel = 'noon' | 'amazon' | 'easyorders' | 'social';

/**
 * How one sales channel refers to one of our products. This is the join that
 * keeps inventory coherent: three listings on three channels resolve to one
 * Product, so three sales decrement one pool of stock.
 */
@Entity('channel_listing')
// One listing per (channel, product, variant) the channel knows about.
@Unique('uq_listing_channel_external', ['channel', 'externalId', 'externalVariantId'])
export class ChannelListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  channel: Channel;

  /**
   * The channel's own product identifier, whatever shape it takes: a noon SKU
   * (`Z877A…Z-1`) or an Easy Orders UUID. Opaque on purpose — Easy Orders has
   * no SKU field at all, so no single external scheme can be assumed.
   */
  @Column({ type: 'text' })
  externalId: string;

  /**
   * The channel's variant identifier where it has one (Easy Orders sends
   * `variant_id`). Empty string rather than null so the unique key works.
   */
  @Column({ type: 'text', default: '' })
  externalVariantId: string;

  /** Last price the channel showed. Reconciliation only, never truth. */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  price: string | null;

  /**
   * Our own SKU as registered with the channel, e.g. noon's `Partner SKUs`
   * (`PSKU_346654_…`). This is what makes import-time resolution reliable.
   */
  @Index('ix_listing_partner_sku')
  @Column({ type: 'text', nullable: true })
  partnerSku: string | null;

  /** Last title seen from the channel — useful for recognising a stub. */
  @Column({ type: 'text', nullable: true })
  title: string | null;

  /** Resolves to a variant, so three channels selling it share one stock pool. */
  @ManyToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Index('ix_listing_variant')
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
