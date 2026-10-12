import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A business we sell to on invoice — wholesale buyers. Retail customers of
 * orders stay on the order itself. What a customer owes is not stored here; it
 * is derived from their posted sales invoices.
 */
@Entity('customer')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** As the business writes it — usually Arabic. */
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
