import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductVariant } from '../catalog/product-variant.entity';
import { Order } from './order.entity';

/**
 * One line of an order.
 *
 * `variantId` is nullable on purpose: an order can arrive from a channel
 * referencing something we have not mapped yet. Losing the order would be worse
 * than holding it with an unresolved line, so the external identifiers and the
 * title are kept and the line can be matched later.
 */
@Entity('order_item')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (o) => o.items, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index('ix_order_item_order')
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  /** Null while the line is unmapped. */
  @Index('ix_order_item_variant')
  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

  /** The channel's identifiers, so the line can be resolved later. */
  @Column({ type: 'text', nullable: true })
  externalProductId: string | null;

  @Column({ type: 'text', nullable: true })
  externalVariantId: string | null;

  /** Title as it was at the time of sale — never re-read from the product. */
  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'int' })
  quantity: number;

  /** Price charged per unit at the time of sale. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  unitPrice: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  lineTotal: string;
}
