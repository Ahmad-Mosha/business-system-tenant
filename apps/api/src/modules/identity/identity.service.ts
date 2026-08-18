import type { PermissionScope } from '@app/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, schema, type Database } from '../../db/db.module.js';
import { AuthContext, broadestScope, type AuthenticatedUser } from './auth-context.js';

@Injectable()
export class IdentityService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Loads the user together with every grant their roles confer, in one query.
   * Read fresh per request so a revoked role takes effect immediately rather than
   * lingering until the session expires.
   */
  async loadAuthContext(userId: string): Promise<AuthContext | null> {
    const rows = await this.db
      .select({
        userId: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        status: schema.users.status,
        mustChangePassword: schema.users.mustChangePassword,
        organizationId: schema.organizations.id,
        organizationName: schema.organizations.name,
        roleCode: schema.roles.code,
        permissionCode: schema.rolePermissions.permissionCode,
        scope: schema.rolePermissions.scope,
      })
      .from(schema.users)
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.users.organizationId))
      .leftJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
      .leftJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .leftJoin(
        schema.rolePermissions,
        eq(schema.rolePermissions.roleId, schema.roles.id),
      )
      .where(and(eq(schema.users.id, userId), eq(schema.users.status, 'ACTIVE')));

    const first = rows[0];
    if (!first) return null;

    const user: AuthenticatedUser = {
      id: first.userId,
      email: first.email,
      name: first.name,
      organizationId: first.organizationId,
      organizationName: first.organizationName,
      mustChangePassword: first.mustChangePassword,
    };

    const roles = new Set<string>();
    const grants = new Map<string, PermissionScope>();
    for (const row of rows) {
      if (row.roleCode) roles.add(row.roleCode);
      if (!row.permissionCode || !row.scope) continue;
      const existing = grants.get(row.permissionCode);
      grants.set(
        row.permissionCode,
        existing ? broadestScope(existing, row.scope) : row.scope,
      );
    }

    return new AuthContext(user, [...roles].sort(), grants);
  }

  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.trim().toLowerCase()))
      .limit(1);
    return user ?? null;
  }

  async recordLogin(userId: string): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }
}
