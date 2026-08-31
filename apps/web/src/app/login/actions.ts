'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/session';

const API = process.env.API_URL ?? 'http://localhost:3001';

export type LoginState = { status: 'idle' } | { status: 'error'; message: string };

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { status: 'error', message: 'Enter your email and password.' };
  }

  let res: Response;
  try {
    res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { status: 'error', message: 'Could not reach the server.' };
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { status: 'error', message: detail?.message ?? 'Incorrect email or password.' };
  }

  const data = await res.json().catch(() => null);
  const isModerator = data?.user?.role === 'MODERATOR';

  // The API issues the token on its own origin; re-set it on this one so the
  // browser never needs to talk to the API directly.
  const setCookie = res.headers.get('set-cookie') ?? '';
  const token = /pm_session=([^;]+)/.exec(setCookie)?.[1];
  if (!token) return { status: 'error', message: 'The server did not return a session.' };

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60,
    path: '/',
  });

  redirect(isModerator ? '/orders' : '/');
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
