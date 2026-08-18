import type { CurrentUser } from '@app/contracts';
import { redirect } from 'next/navigation';
import { ApiRequestError, apiGet } from './api';

export { can, isScopedToSelf } from './permissions';

/** Returns the signed-in user, or null when there is no valid session. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await apiGet<CurrentUser>('/auth/me');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return null;
    throw error;
  }
}

/** For pages that require a session: sends anonymous visitors to the login screen. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
