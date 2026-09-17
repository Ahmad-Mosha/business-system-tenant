import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword, verifyPassword } from './password';
import { User, type UserRole } from './user.entity';
import type { SessionUser } from './auth.guard';
import { resolveInitialPasswords } from './bootstrap-config';
import { problem } from '../problem';

/**
 * The two named accounts, created on boot only when the table is empty. Their
 * passwords are resolved at startup, after ConfigModule has loaded local env
 * files. Production refuses missing or known development credentials.
 */
const INITIAL_USERS: Array<{ email: string; name: string; role: UserRole; password: 'admin' | 'moderator' }> = [
  {
    email: 'admin@admin.com',
    name: 'Admin',
    role: 'ADMIN',
    password: 'admin',
  },
  {
    email: 'moderator@moderator.com',
    name: 'Moderator',
    role: 'MODERATOR',
    password: 'moderator',
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
   * Seeds initial accounts only into an empty table. The table lock makes this
   * safe when more than one API process starts against a new database.
   */
  async seedInitialUsers(): Promise<void> {
    if ((await this.users.count()) > 0) return;
    const passwords = resolveInitialPasswords(process.env);
    const users = await Promise.all(INITIAL_USERS.map(async (user) => ({
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: await hashPassword(passwords[user.password]),
    })));

    const seeded = await this.users.manager.transaction(async (tx) => {
      await tx.query('LOCK TABLE app_user IN SHARE ROW EXCLUSIVE MODE');
      if ((await tx.count(User)) > 0) return false;
      await tx.save(User, users.map((user) => tx.create(User, user)));
      return true;
    });
    if (seeded) {
      this.log.warn(`seeded initial accounts: ${INITIAL_USERS.map((user) => user.email).join(', ')}`);
    }
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

    if (!name) throw new BadRequestException(problem('auth.name', 'name is required'));
    if (!AuthService.EMAIL.test(email)) {
      throw new BadRequestException(problem('auth.email', 'enter a valid email address'));
    }
    if (password.length < 6) {
      throw new BadRequestException(problem('auth.password', 'password must be at least 6 characters'));
    }

    if (await this.users.findOne({ where: { email } })) {
      throw new BadRequestException(problem('auth.emailTaken', `${email} is already in use`, { email }));
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
