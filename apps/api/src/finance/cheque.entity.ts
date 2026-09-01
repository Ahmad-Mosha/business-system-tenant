import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ChequeStatus = 'PENDING' | 'CLEARED' | 'BOUNCED';

/**
 * A cheque received (إيداع سندي) — held in the `CHEQUES_PENDING` account until
 * it clears into cash or bounces. Money on a cheque is never counted as cash
 * until the bank confirms it, which is the whole reason this is separate from a
 * cash deposit.
 */
@Entity('cheque')
export class Cheque {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  /** Who the cheque is from — free text (an owner, a customer). */
  @Column({ type: 'text' })
  fromParty: string;

  @Column({ type: 'date' })
  receivedDate: string;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Index('ix_cheque_status')
  @Column({ type: 'text', default: 'PENDING' })
  status: ChequeStatus;

  @Column({ type: 'date', nullable: true })
  clearedDate: string | null;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  /** The `CHEQUE_DEPOSIT` entry created on receipt — reversed if it bounces. */
  @Column({ name: 'deposit_entry_id', type: 'uuid', nullable: true })
  depositEntryId: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
