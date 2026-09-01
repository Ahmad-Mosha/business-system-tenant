import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductVariant } from '../catalog/product-variant.entity';
import { Supplier } from './supplier.entity';

export type PurchaseStatus = 'DRAFT' | 'POSTED';
export type PurchasePayment = 'CASH' | 'CREDIT';
export type CostAllocation = 'BY_VALUE' | 'PER_UNIT';

/**
 * A purchase invoice — فاتورة شراء. While `DRAFT` it is just a plan; posting it
 * is the single event that brings the goods into stock at their landed cost,
 * updates each variant's moving-average cost, and books the money side.
 * A posted invoice is immutable; a mistake is a new reversing invoice.
 */
@Entity('purchase_invoice')
export class PurchaseInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Supplier, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Index('ix_purchase_supplier')
  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  /** The supplier's own invoice reference, if there is one. */
  @Column({ type: 'text', nullable: true })
  invoiceNo: string | null;

  @Column({ type: 'date' })
  invoiceDate: string;

  @Index('ix_purchase_status')
  @Column({ type: 'text', default: 'DRAFT' })
  status: PurchaseStatus;

  @Column({ type: 'text', default: 'CREDIT' })
  payment: PurchasePayment;

  /** Sum of the lines, before extra costs. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  goodsTotal: string;

  /** Shipping, customs, clearance — spread across the lines on posting. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  extraCosts: string;

  @Column({ type: 'text', default: 'BY_VALUE' })
  allocation: CostAllocation;

  /** `goodsTotal + extraCosts` — what actually reaches inventory. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  landedTotal: string;

  @Column({ type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @OneToMany(() => PurchaseInvoiceLine, (l) => l.invoice, { cascade: ['insert'] })
  lines: PurchaseInvoiceLine[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('purchase_invoice_line')
export class PurchaseInvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PurchaseInvoice, (i) => i.lines, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: PurchaseInvoice;

  @Index('ix_purchase_line_invoice')
  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @Column({ type: 'int' })
  quantity: number;

  /** Goods cost per unit, before any allocation. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  unitCost: string;

  /** Per-unit cost after this line's share of extra costs — filled on posting. */
  @Column({ type: 'numeric', precision: 14, scale: 4, nullable: true })
  landedUnitCost: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  lineTotal: string;
}
