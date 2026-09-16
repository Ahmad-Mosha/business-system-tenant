'use server';
import { revalidatePath } from 'next/cache';
import { apiRequest } from '@/lib/api-request';
import type { DialogFormState } from '@/components/form-dialog';

export async function recordExpense(requestId: string, form: FormData): Promise<DialogFormState> {
  const r = await apiRequest('/expenses', 'POST', {
    requestId, amount: String(form.get('amount') ?? ''), category: String(form.get('category') ?? ''),
    spentOn: String(form.get('spentOn') ?? ''), note: String(form.get('note') ?? ''),
  });
  if (!r.ok) return { status: 'error', message: r.message };
  revalidatePath('/money', 'layout');
  return { status: 'saved' };
}

export async function voidExpense(id: string, form: FormData): Promise<DialogFormState> {
  const r = await apiRequest(`/expenses/${id}/void`, 'POST', { reason: String(form.get('reason') ?? '') });
  if (!r.ok) return { status: 'error', message: r.message };
  revalidatePath('/money', 'layout');
  return { status: 'saved' };
}
