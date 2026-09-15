'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { apiRequest } from '@/lib/api-request';

export type ModeratorFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'saved'; message: string };

export async function addModerator(
  _prev: ModeratorFormState,
  formData: FormData,
): Promise<ModeratorFormState> {
  const r = await apiRequest<{ name: string; email: string }>('/auth/moderators', 'POST', {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!r.ok) return { status: 'error', message: r.message };

  revalidatePath('/team');
  const t = await getTranslations('team');
  return { status: 'saved', message: t('canSignIn', { name: r.data.name, email: r.data.email }) };
}
