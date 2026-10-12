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
import { ProductVariant } from '../catalog/product-variant.entity';
import { Customer } from './customer.entity';

export type SalesInvoiceStatus = 'DRAFT' | 'POSTED' | 'VOID';

/**
 * A sales invoice — فاتورة بيع — for selling outside the order workflow,
 * typically wholesale to a known customer. While `DRAFT` it is only a plan:
 * nothing leaves stock and nothing reaches the books. It is the single source
 * of whatever effect posting it has; an order is never invoiced into a second
 * effect.
 */
@Entity('sales_invoice')
@Unique('uq_sales_invoice_request', ['requestId'])
@Unique('uq_sales_invoice_number', ['invoiceNumber'])
export class SalesInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The submitting form's id, so a resent submission returns this invoice instead of a second one. */
  @Column({ name: 'request_id', type: 'uuid', nullable: true })
  requestId: string | null;

  /** `SI-1001`, given when the invoice is posted so posted numbers run without gaps. */
  @Column({ type: 'text', nullable: true })
  invoiceNumber: string | null;

  @ManyToOne(() => Customer, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Index('ix_sales_invoice_customer')
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ type: 'date' })
  invoiceDate: string;

  @Index('ix_sales_invoice_status')
  @Column({ type: 'text', default: 'DRAFT' })
  status: SalesInvoiceStatus;

  /** Sum of the lines. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  goodsTotal: string;

  /** An amount off the whole invoice. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  discount: string;

  /** `goodsTotal − discount` — what the customer is charged. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  total: string;

  /** Received from the customer against this invoice so far. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  paidAmount: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @OneToMany(() => SalesInvoiceLine, (l) => l.invoice)
  lines: SalesInvoiceLine[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('sales_invoice_line')
export class SalesInvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SalesInvoice, (i) => i.lines, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: SalesInvoice;

  @Index('ix_sales_line_invoice')
  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Index('ix_sales_line_variant')
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @Column({ type: 'int' })
  quantity: number;

  /** Typed, or derived from a typed line total (4 decimals). */
  @Column({ type: 'numeric', precision: 14, scale: 4 })
  unitPrice: string;

  /** What the customer is charged for the line — when typed, kept exactly. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  lineTotal: string;

  /** The inventory cost per piece when the invoice was posted, kept for its profit. */
  @Column({ type: 'numeric', precision: 16, scale: 4, nullable: true })
  unitCost: string | null;
}
