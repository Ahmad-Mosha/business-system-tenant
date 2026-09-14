'use server';

import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/session';

const API = process.env.API_URL ?? 'http://localhost:3001';

export type LoginState = { status: 'idle' } | { status: 'error'; message: string };

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const t = await getTranslations('auth');
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { status: 'error', message: t('missing') };
  }

  let res: Response;
  try {
    res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { status: 'error', message: t('unreachable') };
  }

  // The API's one sign-in refusal is 401 "Incorrect email or password" — said
  // here in the reader's language; anything else keeps the API's own words.
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { status: 'error', message: res.status === 401 ? t('wrong') : (detail?.message ?? t('wrong')) };
  }

  const data = await res.json().catch(() => null);
  const isModerator = data?.user?.role === 'MODERATOR';

  // The API issues the token on its own origin; re-set it on this one so the
  // browser never needs to talk to the API directly.
  const setCookie = res.headers.get('set-cookie') ?? '';
  const token = /pm_session=([^;]+)/.exec(setCookie)?.[1];
  if (!token) return { status: 'error', message: t('noSession') };

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
