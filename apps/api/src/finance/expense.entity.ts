import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { LedgerEntry } from './ledger-entry.entity';

@Entity('expense_category')
@Unique('uq_expense_category_key', ['key'])
export class ExpenseCategory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text' }) name: string;
  @Column({ type: 'text' }) key: string;
}

@Entity('expense')
@Unique('uq_expense_request', ['requestId'])
export class Expense {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) requestId: string;
  @ManyToOne(() => ExpenseCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' }) category: ExpenseCategory;
  @Column({ type: 'uuid' }) categoryId: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) amount: string;
  @Column({ type: 'date' }) spentOn: string;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @ManyToOne(() => LedgerEntry, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ledger_entry_id' }) ledgerEntry: LedgerEntry;
  @Column({ type: 'uuid' }) ledgerEntryId: string;
  @Column({ type: 'uuid' }) createdById: string;
  @Column({ type: 'timestamptz', nullable: true }) voidedAt: Date | null;
  @Column({ type: 'text', nullable: true }) voidReason: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
