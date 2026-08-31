import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { ProductVariant } from './product-variant.entity';

/**
 * The business's fixed category vocabulary. A plain `text` column rather than
 * a Postgres enum — adding a category should never need a migration — but
 * validated against this list everywhere a category is written, so the value
 * space stays exactly these four rather than drifting into free text.
 */
export const PRODUCT_CATEGORIES = ['COSMETICS', 'HOME', 'ELECTRONICS', 'TV_SHOP'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * The internal identity of a real thing Prime Market sells. Stable across
 * channels: marketplace SKUs point at this, never the other way round.
 *
 * Products originate from our own inventory system (Mega export today, manual
 * entry otherwise) — never auto-created from a sales channel. A channel's
 * listing must be attached to an existing product; it does not get to invent
 * one. `megaId` is Mega's own internal row id, kept only so a later Mega
 * export can be re-imported as an upsert instead of creating duplicates.
 */
@Entity('product')
@Unique('uq_product_mega_id', ['megaId'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  category: ProductCategory | null;

  /** Mega's internal product id. Null for products created manually. */
  @Column({ type: 'text', nullable: true })
  megaId: string | null;

  /**
   * True while the product is an unenriched stub. Nothing creates these any
   * more (see class doc), kept only so a genuinely orphaned channel listing
   * has somewhere to point rather than being silently dropped, and so a badge
   * built for it stays meaningful if that ever changes.
   */
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
