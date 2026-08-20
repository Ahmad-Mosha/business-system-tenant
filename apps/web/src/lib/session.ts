import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const SESSION_COOKIE = 'pm_session';

export type Role = 'ADMIN' | 'MODERATOR';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

const API = process.env.API_URL ?? 'http://localhost:3001';

/** Forwards the browser's session cookie on to the API. */
export async function authHeaders(): Promise<HeadersInit> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {};
}

/**
 * The signed-in user, or null. The API is the authority — the cookie is only
 * a bearer, never trusted for its contents.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const res = await fetch(`${API}/auth/me`, {
    headers: { Cookie: `${SESSION_COOKIE}=${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as SessionUser;
}

/** For pages that require a session. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect('/login');
  return user;
}

/**
 * For admin-only pages. The API enforces this too — this only avoids rendering
 * a screen the user could not use.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (user.role !== 'ADMIN') redirect('/orders');
  return user;
}
