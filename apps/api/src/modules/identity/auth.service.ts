import { Injectable } from '@nestjs/common';
import {
  AccountDisabledError,
  InvalidCredentialsError,
} from '../../shared/errors.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from './auth-context.js';
import { IdentityService } from './identity.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

export interface LoginMeta {
  userAgent?: string;
  ipAddress?: string;
  correlationId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly identity: IdentityService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
    meta: LoginMeta,
  ): Promise<{ token: string; expiresAt: Date; auth: AuthContext }> {
    const user = await this.identity.findByEmail(email);

    if (!user) {
      // Spend the same time as a real verification so timing does not leak which
      // emails exist, then fail with the same message as a wrong password.
      await this.passwords.verifyDecoy(password);
      await this.audit.record({
        actor: { type: 'SYSTEM' },
        action: 'auth.login.failed',
        data: { email, reason: 'UNKNOWN_EMAIL' },
        correlationId: meta.correlationId,
      });
      throw new InvalidCredentialsError();
    }

    const passwordValid = await this.passwords.verify(user.passwordHash, password);
    if (!passwordValid) {
      await this.audit.record({
        actor: { type: 'SYSTEM', organizationId: user.organizationId },
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: user.id,
        data: { reason: 'BAD_PASSWORD' },
        correlationId: meta.correlationId,
      });
      throw new InvalidCredentialsError();
    }

    // Checked after the password so a disabled account is not discoverable by
    // probing with a wrong password.
    if (user.status !== 'ACTIVE') {
      await this.audit.record({
        actor: { type: 'SYSTEM', organizationId: user.organizationId },
        action: 'auth.login.blocked',
        entityType: 'user',
        entityId: user.id,
        data: { reason: 'ACCOUNT_DISABLED' },
        correlationId: meta.correlationId,
      });
      throw new AccountDisabledError();
    }

    const auth = await this.identity.loadAuthContext(user.id);
    if (!auth) throw new InvalidCredentialsError();

    const session = await this.sessions.create(user.id, meta);
    await this.identity.recordLogin(user.id);
    await this.audit.record({
      actor: { type: 'USER', userId: user.id, organizationId: user.organizationId },
      action: 'auth.login.succeeded',
      entityType: 'user',
      entityId: user.id,
      correlationId: meta.correlationId,
    });

    return { token: session.token, expiresAt: session.expiresAt, auth };
  }

  async logout(token: string, auth: AuthContext, correlationId?: string): Promise<void> {
    await this.sessions.revoke(token);
    await this.audit.record({
      actor: {
        type: 'USER',
        userId: auth.user.id,
        organizationId: auth.user.organizationId,
      },
      action: 'auth.logout',
      entityType: 'user',
      entityId: auth.user.id,
      correlationId,
    });
  }

  /**
   * Changing a password invalidates every other session for that user: if the change
   * was prompted by a suspected compromise, the attacker's session must die with it.
   */
  async changePassword(
    auth: AuthContext,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
    correlationId?: string,
  ): Promise<void> {
    const user = await this.identity.findByEmail(auth.user.email);
    if (!user) throw new InvalidCredentialsError();

    const valid = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!valid) throw new InvalidCredentialsError();

    await this.identity.updatePassword(user.id, await this.passwords.hash(newPassword));
    await this.sessions.revokeAllForUser(user.id, sessionId);
    await this.audit.record({
      actor: { type: 'USER', userId: user.id, organizationId: user.organizationId },
      action: 'auth.password.changed',
      entityType: 'user',
      entityId: user.id,
      correlationId,
    });
  }
}
