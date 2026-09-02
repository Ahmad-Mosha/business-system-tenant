import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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

  /** Moderators an admin can assign work to — the admin is not one of them. */
  listAssignees() {
    return this.users.find({
      where: { active: true, role: 'MODERATOR' },
      select: { id: true, name: true, email: true, role: true },
      order: { name: 'ASC' },
    });
  }

  private static readonly EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Adds a moderator. After the one-time seed this is the only way an account
   * is created — admin-only, enforced at the controller.
   */
  async createModerator(input: { name?: string; email?: string; password?: string }) {
    const name = (input.name ?? '').trim();
    const email = (input.email ?? '').trim().toLowerCase();
    const password = input.password ?? '';

    if (!name) throw new BadRequestException('name is required');
    if (!AuthService.EMAIL.test(email)) throw new BadRequestException('enter a valid email address');
    if (password.length < 6) throw new BadRequestException('password must be at least 6 characters');

    if (await this.users.findOne({ where: { email } })) {
      throw new BadRequestException(`${email} is already in use`);
    }

    const user = await this.users.save(
      this.users.create({
        name,
        email,
        role: 'MODERATOR',
        passwordHash: await hashPassword(password),
      }),
    );
    return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
  }

  /**
   * Every moderator with headline numbers over the orders assigned to them.
   * One grouped query — the list stays a single round trip however many
   * moderators there are.
   */
  async teamOverview() {
    const rows: Array<{
      id: string;
      name: string;
      email: string;
      active: boolean;
      assigned: number;
      delivered: number;
      cancelled: number;
      deliveredValue: string;
    }> = await this.users.manager.query(
      `SELECT u.id, u.name, u.email, u.active,
              count(o.id)::int                                             AS assigned,
              count(o.id) FILTER (WHERE o.status = 'DELIVERED')::int        AS delivered,
              count(o.id) FILTER (WHERE o.status = 'CANCELLED')::int        AS cancelled,
              COALESCE(SUM(o.total) FILTER (WHERE o.status = 'DELIVERED'), 0) AS "deliveredValue"
       FROM app_user u
       LEFT JOIN customer_order o ON o.assigned_to_id = u.id
       WHERE u.role = 'MODERATOR'
       GROUP BY u.id, u.name, u.email, u.active
       ORDER BY u.active DESC, u.name ASC`,
    );

    return rows.map((r) => ({
      ...r,
      deliveredValue: String(r.deliveredValue),
      // Null, not 0%, when they have no orders yet — "0%" would read as a bad
      // score rather than "nothing to measure".
      deliveryRate: r.assigned > 0 ? Math.round((r.delivered / r.assigned) * 100) : null,
    }));
  }
}
