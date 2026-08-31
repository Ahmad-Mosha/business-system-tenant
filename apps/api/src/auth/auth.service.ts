import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service.js';
import { TenantService } from '../db/tenant.service.js';
import { users } from '../db/schema.js';
import type { LoginResponseDto } from './dto.js';
import { verifyPassword } from './password.js';

export interface TokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  email: string;
}

export const TOKEN_TTL_SECONDS = 12 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly tenants: TenantService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const tenant = await this.tenants.current();

    const [user] = await this.db.asTenant(tenant.id, (tx) =>
      tx
        .select()
        .from(users)
        .where(and(sql`lower(${users.email}) = lower(${email})`, eq(users.active, true)))
        .limit(1),
    );

    // One message for "no such user" and "wrong password" — a different
    // response for each tells an attacker which emails exist.
    const ok = user && (await verifyPassword(password, user.passwordHash));
    if (!ok) throw new UnauthorizedException('Email or password is incorrect');

    const payload: TokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };

    return {
      accessToken: await this.jwt.signAsync(payload, { expiresIn: TOKEN_TTL_SECONDS }),
      expiresIn: TOKEN_TTL_SECONDS,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
