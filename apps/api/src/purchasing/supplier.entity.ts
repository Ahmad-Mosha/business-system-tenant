import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A supplier we buy stock from. Their outstanding balance is not stored here —
 * it is `SUPPLIER_PAYABLE` in the ledger, filtered to this supplier's id.
 */
@Entity('supplier')
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Arabic, as the business writes it. */
  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
