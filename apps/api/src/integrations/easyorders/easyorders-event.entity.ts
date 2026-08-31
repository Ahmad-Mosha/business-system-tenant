import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * Every webhook delivery, stored raw before anything is parsed.
 *
 * The payload lands here first so that a malformed body, an unknown product or
 * a bug in our mapping can never lose a real customer order — it can be
 * inspected and replayed.
 */
@Entity('easyorders_event')
@Unique('uq_easyorders_event_fingerprint', ['fingerprint'])
export class EasyOrdersEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** SHA-256 of the raw body: a redelivered webhook is recognised and ignored. */
  @Column({ type: 'text' })
  fingerprint: string;

  /** `order-created` or the `event_type` the payload carried. */
  @Column({ type: 'text' })
  eventType: string;

  @Index('ix_easyorders_event_order')
  @Column({ type: 'text', nullable: true })
  externalOrderId: string | null;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  /** Set when processing failed, so failures are visible rather than silent. */
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt: Date;
}
