import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ChannelListing } from './channel-listing.entity';

/**
 * The internal identity of a real thing Prime Market sells. Stable across
 * channels: marketplace SKUs point at this, never the other way round.
 *
 * Products are usually born from an import rather than typed in — the first
 * time a marketplace SKU is seen, a stub is created and flagged `discovered`
 * so someone can enrich it later.
 */
@Entity('product')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  category: string | null;

  /**
   * Cost basis per unit, in EGP. Null until purchasing data is entered — no
   * marketplace report contains cost, so margin stays unknown until it is.
   * ponytail: a single current cost, not FIFO layers. Revisit when purchase
   * batches at different prices start to matter.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  unitCost: string | null;

  /** True while the product is an unenriched stub created by an importer. */
  @Column({ type: 'boolean', default: false })
  discovered: boolean;

  @OneToMany(() => ChannelListing, (l) => l.product)
  listings: ChannelListing[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
