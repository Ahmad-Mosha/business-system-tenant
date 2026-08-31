import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** One upload of a noon settlement export. Kept so every row can be traced back. */
@Entity('noon_import')
@Unique('uq_noon_import_file_hash', ['fileHash'])
export class NoonImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  filename: string;

  /** SHA-256 of the uploaded bytes — re-uploading the identical file is a no-op. */
  @Column({ type: 'text' })
  fileHash: string;

  @Column({ type: 'int' })
  rowsInFile: number;

  @Column({ type: 'int' })
  rowsInserted: number;

  /** Rows already present from an earlier, overlapping export. */
  @Column({ type: 'int' })
  rowsSkipped: number;

  /** Partner SKUs in this file with no matching product — need manual mapping. */
  @Column({ type: 'int', default: 0 })
  unmappedListings: number;

  @Column({ type: 'date', nullable: true })
  periodStart: string | null;

  @Column({ type: 'date', nullable: true })
  periodEnd: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
