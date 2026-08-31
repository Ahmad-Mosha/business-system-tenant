import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

/**
 * The thing that physically sits on a shelf, and the unit everything else
 * points at: stock is counted per variant, channel listings resolve to a
 * variant, and order items reference a variant.
 *
 * A simple product has exactly one variant, created automatically. That costs
 * one row and buys a model that does not have to be rebuilt the first time a
 * product genuinely has sizes — at which point stock held at product level
 * would already be wrong.
 */
@Entity('product_variant')
// Our own SKU, when we choose to assign one. Optional: social sales have none.
@Unique('uq_variant_sku', ['sku'])
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (p) => p.variants, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Index('ix_variant_product')
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  /** `Default` for single-variant products, otherwise e.g. `Large`, `Red / L`. */
  @Column({ type: 'text', default: 'Default' })
  name: string;

  /** Prime Market's own SKU. Null until someone assigns one. */
  @Column({ type: 'text', nullable: true })
  sku: string | null;

  /**
   * What distinguishes this variant, e.g. `{"size":"L","color":"black"}`.
   * Free-form because channels name their attributes differently — Easy Orders
   * sends `variation_props` with arbitrary `variation` names.
   */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, string>;

  /**
   * Current purchase cost per unit, EGP.
   * ponytail: a single current figure, not FIFO/average layers. Costing method
   * is deliberately undecided — see docs/decisions/001.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  unitCost: string | null;

  /** Default selling price. Channels may override; a listing keeps its own. */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  sellingPrice: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
