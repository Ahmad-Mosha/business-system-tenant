import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** One upload of an Amazon transaction report. Kept so every row can be traced back. */
@Entity('amazon_import')
@Unique('uq_amazon_import_file_hash', ['fileHash'])
export class AmazonImport {
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

  /** Rows already present from an earlier, overlapping report. */
  @Column({ type: 'int' })
  rowsSkipped: number;

  /** Of those, rows whose money Amazon has since released (or settled) — refreshed. */
  @Column({ type: 'int', default: 0 })
  rowsUpdated: number;

  /** Seller SKUs in this file with no matching product — need linking. */
  @Column({ type: 'int', default: 0 })
  unmappedListings: number;

  /** Cairo days of the first and last line. */
  @Column({ type: 'date', nullable: true })
  periodStart: string | null;

  @Column({ type: 'date', nullable: true })
  periodEnd: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
