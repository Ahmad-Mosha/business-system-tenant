import { getTranslations } from 'next-intl/server';
import type { Problem } from './problem';
import { authHeaders } from './session';

const API = process.env.API_URL ?? 'http://localhost:3001';

/** A refusal keeps its `problem` — the screen can then name and link what's in the way. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; problem?: Problem };

/** A bare HTTP status, in words a person can act on — never the API's own text. */
const STATUS: Record<number, string> = {
  400: 'status.invalid',
  401: 'api.auth.required',
  403: 'api.auth.forbidden',
  404: 'api.notFound',
  409: 'status.conflict',
};

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
  // A problem the API names (apps/api/src/problem.ts) reads in the reader's
  // language: its headline, then each reason, so even a toast says it all.
  if (typeof data?.code === 'string') {
    const problem: Problem = { code: data.code, params: data.params, blockers: data.blockers, reasons: data.reasons };
    const say = (code: string, params?: Record<string, string | number>) => {
      const key = `api.${code}` as Parameters<typeof t>[0];
      return t.has(key) ? t(key, params ?? {}) : null;
    };
    const words = [say(problem.code, problem.params), ...(problem.reasons ?? []).map((r) => say(r.code, r.params))].filter(Boolean);
    if (words.length) return { ok: false, message: words.join(' '), problem };
  }
  // Anything else is for the logs, not for a person: an English validation
  // line or "Internal server error" says nothing they can act on.
  console.warn(`API ${method} ${path} → ${res.status}`, data?.message ?? '');
  const key = (STATUS[res.status] ?? (res.status >= 500 ? 'status.server' : 'status.unknown')) as Parameters<typeof t>[0];
  return { ok: false, message: t(key) };
}
