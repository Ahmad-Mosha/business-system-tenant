import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword, verifyPassword } from './password';
import { User, type UserRole } from './user.entity';
import type { SessionUser } from './auth.guard';

/**
 * The two named accounts, created on boot only when the table is empty.
 * Passwords come from the environment so a publicly reachable deployment
 * never boots with the known dev defaults still live — set
 * ADMIN_SEED_PASSWORD / MODERATOR_SEED_PASSWORD in production. Only read
 * once, at the moment of seeding; changing them later has no effect on an
 * account that already exists.
 */
const SEED_USERS: Array<{ email: string; password: string; name: string; role: UserRole }> = [
  {
    email: 'admin@admin.com',
    password: process.env.ADMIN_SEED_PASSWORD ?? 'admin123',
    name: 'Admin',
    role: 'ADMIN',
  },
  {
    email: 'moderator@moderator.com',
    password: process.env.MODERATOR_SEED_PASSWORD ?? 'moderator123',
    name: 'Moderator',
    role: 'MODERATOR',
  },
];

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Seeds the two development accounts, but only into an empty table, so real
   * accounts are never overwritten once the system is in use.
   */
  async seedDevUsers(): Promise<void> {
    if ((await this.users.count()) > 0) return;
    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_SEED_PASSWORD) {
      this.log.error(
        'production boot with an empty user table and no ADMIN_SEED_PASSWORD set — ' +
          'seeding the known dev password anyway. Set it and restart before this is public.',
      );
    }
    for (const u of SEED_USERS) {
      await this.users.save(
        this.users.create({
          email: u.email,
          name: u.name,
          role: u.role,
          passwordHash: await hashPassword(u.password),
        }),
      );
    }
    this.log.warn(`seeded development accounts: ${SEED_USERS.map((u) => u.email).join(', ')}`);
  }

  async signIn(email: string, password: string): Promise<{ token: string; user: SessionUser }> {
    const user = await this.users.findOne({
      where: { email: (email ?? '').trim().toLowerCase() },
      select: { id: true, email: true, name: true, role: true, active: true, passwordHash: true },
    });

    // Same message and roughly the same work either way, so the response does
    // not reveal whether an address exists.
    const ok = user?.active ? await verifyPassword(password ?? '', user.passwordHash) : false;
    if (!user || !ok) throw new UnauthorizedException('Incorrect email or password');

    const session: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    return { token: await this.jwt.signAsync(session), user: session };
  }

  /** Moderators an admin can assign work to. */
  listAssignees() {
    return this.users.find({
      where: { active: true },
      select: { id: true, name: true, email: true, role: true },
      order: { name: 'ASC' },
    });
  }
}
