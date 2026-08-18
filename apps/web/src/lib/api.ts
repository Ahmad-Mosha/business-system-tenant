import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Server-side call to the API, forwarding the caller's session cookie.
 *
 * Server components talk to the API directly; the browser goes through the /api
 * rewrite in next.config.ts so the session cookie stays first-party.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { cookie: cookieHeader, accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ApiRequestError(
      res.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? `Request to ${path} failed`,
    );
  }

  return (await res.json()) as T;
}
