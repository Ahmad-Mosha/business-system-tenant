import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * The starting point for the running balance with a sales channel.
 *
 * Settlement exports only cover the periods you download, so the balance they
 * describe is relative, not absolute. One known balance and its date anchors
 * the whole chain: every later balance is this figure plus the movement since.
 *
 * Read it off the channel's own Statement of Account for the month before your
 * earliest import.
 */
@Entity('channel_account')
export class ChannelAccount {
  /** One row per channel; 'noon' today. */
  @PrimaryColumn({ type: 'text' })
  channel: string;

  /** Balance owed to us by the channel immediately before `openingAsOf`. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  openingBalance: string;

  /** The date that balance was true. Movement is counted from here onward. */
  @Column({ type: 'date', nullable: true })
  openingAsOf: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
