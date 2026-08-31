import { cookies } from 'next/headers';
import { cache } from 'react';
import { api } from './api';

export const TOKEN_COOKIE = 'pm_token';

export type Role = 'ADMIN' | 'MODERATOR';

export interface Session {
  id: string;
  email: string;
  role: Role;
}

export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(TOKEN_COOKIE)?.value;
}

/**
 * Who the current token belongs to, asked of the API rather than decoded from
 * the cookie — an expired or forged token has to fail here.
 *
 * `cache` keeps it to one call per request no matter how many components ask.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!(await getToken())) return null;
  return api<Session>('/auth/me').catch(() => null);
});
