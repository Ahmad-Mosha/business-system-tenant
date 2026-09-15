import { getTranslations } from 'next-intl/server';
import { authHeaders } from './session';

const API = process.env.API_URL ?? 'http://localhost:3001';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Every server action's call to the API. A failure is an answer, not an
 * exception: `{ ok: false, message }` carries the API's own reason, or ours in
 * the reader's language when there is none (the API is down, or sent a bare
 * status). This is the one place API errors become words — so when the API
 * sends error codes (docs/i18n.md), they are translated here and nowhere else.
 */
export async function apiRequest<T = unknown>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<ApiResult<T>> {
  const form = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      headers: { ...(form || body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(await authHeaders()) },
      body: form ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: (await getTranslations('errors'))('unreachable') };
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: data as T };

  const t = await getTranslations('errors');
  // A problem the API names (apps/api/src/problem.ts) reads in the reader's language.
  if (typeof data?.code === 'string') {
    const key = `api.${data.code}` as Parameters<typeof t>[0];
    if (t.has(key)) return { ok: false, message: t(key, data.params ?? {}) };
  }
  // Otherwise the API's own reason — one, or a list of them from validation.
  const reason: unknown = data?.message;
  if (typeof reason === 'string' && reason) return { ok: false, message: reason };
  if (Array.isArray(reason) && reason.length) return { ok: false, message: reason.join(' · ') };
  return { ok: false, message: t('requestFailed', { status: res.status }) };
}
