import { getToken } from './session';

const BASE = process.env.API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Server-side call to the API with the signed-in user's token attached.
 *
 * The token lives in an httpOnly cookie and is never handed to the browser, so
 * a script on the page cannot read it. Every request the interface makes goes
 * out from the server.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? res.statusText);
    throw new ApiError(res.status, message);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Reachability of the API and its database, for the status line in the shell. */
export async function health() {
  try {
    return await api<{ status: string; database: string }>('/health');
  } catch {
    return { status: 'unreachable', database: 'unreachable' };
  }
}
