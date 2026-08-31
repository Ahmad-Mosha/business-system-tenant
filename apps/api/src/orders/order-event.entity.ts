import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';

export type OrderEventType =
  | 'CREATED'
  | 'EDITED'
  | 'ASSIGNED'
  | 'STATUS_CHANGED'
  | 'PAYMENT_CHANGED'
  | 'NOTE';

/**
 * Append-only trail of what happened to an order and who did it.
 *
 * Both admins and moderators move orders, so "who confirmed this and when" is
 * an operational question, not an audit luxury.
 */
@Entity('order_event')
export class OrderEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index('ix_order_event_order')
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ type: 'text' })
  type: OrderEventType;

  @Column({ type: 'text', nullable: true })
  fromValue: string | null;

  @Column({ type: 'text', nullable: true })
  toValue: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Null when the change came from an integration rather than a person. */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'text', nullable: true })
  actorName: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
