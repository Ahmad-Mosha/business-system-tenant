import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../auth/user.entity';
import { OrderItem } from './order-item.entity';

/** How the order reached us. Not the same as where the product was listed. */
export type OrderSource = 'EASYORDERS' | 'SOCIAL';

/** The operational lifecycle the team drives. */
export type OrderStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

/** Whether we have the money. Independent of fulfilment — see below. */
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export type PaymentMethod = 'COD' | 'INSTAPAY' | 'WALLET';

/**
 * Allowed moves. Enforced in the service, so an invalid jump is rejected by the
 * API rather than merely hidden by the UI.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['ASSIGNED', 'CONFIRMED', 'CANCELLED'],
  ASSIGNED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

/**
 * A customer order.
 *
 * Fulfilment and payment are **separate** fields, because with cash on delivery
 * an order is routinely delivered while still unpaid — the courier holds the
 * cash for days. One combined status could not express that, and cash
 * reconciliation depends on it.
 *
 * Shipment is deliberately *not* a third state field: a shipment is an entity
 * with its own tracking number and event history, and becomes its own table
 * once Bosta credentials exist. `SHIPPED` is enough until then.
 */
@Entity('customer_order')
// An external order must only ever be ingested once.
@Unique('uq_order_source_external', ['source', 'externalId'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Short human reference used when talking to customers, e.g. `PM-1042`. */
  @Index('ix_order_number')
  @Column({ type: 'text' })
  orderNumber: string;

  @Column({ type: 'text' })
  source: OrderSource;

  /**
   * The channel's own order id, kept so the relationship stays traceable and
   * so re-delivery of a webhook is a no-op. Empty for manual orders.
   */
  @Column({ type: 'text', default: '' })
  externalId: string;

  @Index('ix_order_status')
  @Column({ type: 'text', default: 'NEW' })
  status: OrderStatus;

  @Column({ type: 'text', default: 'UNPAID' })
  paymentStatus: PaymentStatus;

  @Column({ type: 'text', default: 'COD' })
  paymentMethod: PaymentMethod;

  /** The channel's own status string, preserved verbatim rather than guessed. */
  @Column({ type: 'text', nullable: true })
  externalStatus: string | null;

  @Column({ type: 'text' })
  customerName: string;

  @Column({ type: 'text' })
  customerPhone: string;

  /** Governorate — Easy Orders calls this `government`. */
  @Column({ type: 'text', nullable: true })
  governorate: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtotal: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  shippingCost: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  total: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: User | null;

  /** The moderator working this order. Null means unassigned. */
  @Index('ix_order_assigned')
  @Column({ name: 'assigned_to_id', type: 'uuid', nullable: true })
  assignedToId: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: ['insert'] })
  items: OrderItem[];

  /** When the customer placed it, which may predate when we received it. */
  @Index('ix_order_placed_at')
  @Column({ type: 'timestamptz', default: () => 'now()' })
  placedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
