import type { CurrentUser } from '@app/contracts';

/**
 * Pure, client-safe permission helpers.
 *
 * Deliberately separate from lib/session.ts, which reaches for next/headers and is
 * therefore server-only: components that render on both sides must be able to ask
 * "may this user do X?" without dragging server code across the client boundary.
 *
 * This drives what the interface offers. It is never the access decision - the API
 * re-checks every request.
 */
export function can(user: CurrentUser, permission: string): boolean {
  return user.grants.some((grant) => grant.permission === permission);
}

/** Whether the user only sees rows assigned to them for a given permission. */
export function isScopedToSelf(user: CurrentUser, permission: string): boolean {
  return user.grants.some((g) => g.permission === permission && g.scope === 'ASSIGNED');
}
