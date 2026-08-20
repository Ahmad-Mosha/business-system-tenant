import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Product } from './product.entity';

export type Channel = 'noon' | 'amazon' | 'easyorders' | 'social';

/**
 * How one sales channel refers to one of our products. This is the join that
 * keeps inventory coherent: three listings on three channels resolve to one
 * Product, so three sales decrement one pool of stock.
 */
@Entity('channel_listing')
// A channel's own SKU is unique within that channel.
@Unique('uq_listing_channel_sku', ['channel', 'externalSku'])
export class ChannelListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  channel: Channel;

  /** The channel's identifier, e.g. noon's `Z877AF02C8ECC0E81C2EAZ-1`. */
  @Column({ type: 'text' })
  externalSku: string;

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

  @ManyToOne(() => Product, (p) => p.listings, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Index('ix_listing_product')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
