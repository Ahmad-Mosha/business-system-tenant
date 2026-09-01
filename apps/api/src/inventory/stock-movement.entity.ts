import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductVariant } from '../catalog/product-variant.entity';

export type StockReason =
  | 'PURCHASE' // stock bought in
  | 'SALE' // sold and dispatched
  | 'RETURN' // came back from a customer
  | 'ADJUSTMENT' // manual correction
  | 'DAMAGE' // written off
  | 'COUNT'; // reconciliation against a physical count

/**
 * Every change in stock, appended and never edited. Quantity on hand is
 * `SUM(quantity)` for a variant.
 *
 * This is the one inventory decision taken up front: a mutable counter can
 * never answer "why is this 94?", and the history cannot be reconstructed
 * afterwards. What each movement means *financially* is deliberately still
 * open — see docs/decisions/001.
 */
@Entity('stock_movement')
@Index('ix_stock_variant_date', ['variantId', 'occurredAt'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  /** Signed: positive adds stock, negative removes it. */
  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'text' })
  reason: StockReason;

  /** Cost per unit this movement applied — landed cost on a receipt, the
   *  average cost at the time on a sale (which is COGS). Null when unknown. */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  unitCost: string | null;

  /** The variant's moving-average cost right after this movement. Receipts only. */
  @Column({ name: 'avg_cost_after', type: 'numeric', precision: 14, scale: 4, nullable: true })
  avgCostAfter: string | null;

  /** What caused this, e.g. `order` / an order id. Kept loose on purpose. */
  @Column({ type: 'text', nullable: true })
  sourceType: string | null;

  @Column({ type: 'text', nullable: true })
  sourceId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Who recorded it. Null for movements created by an import. */
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  /** When it happened in the business, which may predate when it was entered. */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  occurredAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
