import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type UserRole = 'ADMIN' | 'MODERATOR';

@Entity('app_user')
@Unique('uq_user_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stored lower-cased so sign-in is case-insensitive. */
  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  name: string;

  /** `salt:hash`, scrypt. Never selected unless explicitly asked for. */
  @Column({ type: 'text', select: false })
  passwordHash: string;

  @Column({ type: 'text', default: 'MODERATOR' })
  role: UserRole;

  /** Cleared instead of deleting, so past order assignments still resolve. */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
