import type { PermissionScope } from '@app/contracts';
import { PermissionDeniedError } from '../../shared/errors.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  mustChangePassword: boolean;
}

/**
 * The acting user plus what they may do, resolved once per request.
 *
 * Services ask this object for scope rather than trusting that a guard already
 * filtered: the check that decides which rows are returned lives next to the query
 * that returns them.
 */
export class AuthContext {
  constructor(
    readonly user: AuthenticatedUser,
    readonly roles: readonly string[],
    private readonly grants: ReadonlyMap<string, PermissionScope>,
  ) {}

  scopeFor(permission: string): PermissionScope | undefined {
    return this.grants.get(permission);
  }

  /** Throws unless the user holds `permission`; returns the scope it was granted with. */
  requireScope(permission: string): PermissionScope {
    const scope = this.grants.get(permission);
    if (!scope) throw new PermissionDeniedError(permission);
    return scope;
  }

  toGrantList(): { permission: string; scope: PermissionScope }[] {
    return [...this.grants].map(([permission, scope]) => ({ permission, scope }));
  }
}

/** ALL is strictly broader than ASSIGNED, so a user holding both keeps ALL. */
export function broadestScope(a: PermissionScope, b: PermissionScope): PermissionScope {
  return a === 'ALL' || b === 'ALL' ? 'ALL' : 'ASSIGNED';
}
