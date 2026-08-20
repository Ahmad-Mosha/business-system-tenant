import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ProductVariant } from './product-variant.entity';

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

  /** True while the product is an unenriched stub created by an importer. */
  @Column({ type: 'boolean', default: false })
  discovered: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** Cost and price live on the variant — that is what is actually bought and sold. */
  @OneToMany(() => ProductVariant, (v) => v.product)
  variants: ProductVariant[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
