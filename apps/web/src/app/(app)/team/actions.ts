'use server';

import { revalidatePath } from 'next/cache';
import { authHeaders } from '@/lib/session';

const API = process.env.API_URL ?? 'http://localhost:3001';

export type ModeratorFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'saved'; message: string };

export async function addModerator(
  _prev: ModeratorFormState,
  formData: FormData,
): Promise<ModeratorFormState> {
  const res = await fetch(`${API}/auth/moderators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { status: 'error', message: detail?.message ?? 'Could not add the moderator' };
  }

  const m = (await res.json()) as { name: string; email: string };
  revalidatePath('/team');
  return { status: 'saved', message: `${m.name} can sign in with ${m.email}.` };
}
