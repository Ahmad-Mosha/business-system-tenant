'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { apiRequest } from '@/lib/api-request';
import { channelPath, type Marketplace } from '@/lib/channels';

export interface ImportOutcome {
  importId: string;
  alreadyImported: boolean;
  rowsInFile: number;
  rowsInserted: number;
  rowsSkipped: number;
  /** Amazon: lines already held whose money was released since. */
  rowsUpdated?: number;
  unmappedListings: number;
  periodStart: string | null;
  periodEnd: string | null;
  /** Units the file's orders and returns moved on stock. */
  stockMoved?: number;
  /** Sold before the opening count — already reflected in it, so stock was left alone. */
  stockBeforeOpening?: number;
}

export type UploadState =
  | { status: 'idle' }
  | { status: 'done'; result: ImportOutcome; filename: string }
  | { status: 'error'; message: string; problem?: import('@/lib/problem').Problem };

export type AnchorState = { status: 'idle' } | { status: 'saved' } | { status: 'error'; message: string; problem?: import('@/lib/problem').Problem };

function revalidateChannel(channel: Marketplace) {
  for (const screen of ['', 'products', 'imports'] as const) revalidatePath(channelPath(channel, screen));
  revalidatePath('/money');
}

/** Forwards a marketplace report to the API, which reads, matches and stores it. */
export async function uploadReport(channel: Marketplace, _previous: UploadState, formData: FormData): Promise<UploadState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: (await getTranslations('validation'))('csvFile') };
  }
  const body = new FormData();
  body.append('file', file, file.name);
  const r = await apiRequest<ImportOutcome>(`/${channel}/imports`, 'POST', body);
  if (!r.ok) return { status: 'error', message: r.message, problem: r.problem };
  revalidateChannel(channel);
  return { status: 'done', result: r.data, filename: file.name };
}

/** The balance the marketplace owed before the earliest report — every later balance follows from it. */
export async function setOpeningBalance(channel: Marketplace, _previous: AnchorState, formData: FormData): Promise<AnchorState> {
  const openingBalance = String(formData.get('openingBalance') ?? '').trim();
  const openingAsOf = String(formData.get('openingAsOf') ?? '').trim();
  const t = await getTranslations('validation');
  if (!/^-?\d+(\.\d{1,2})?$/.test(openingBalance)) return { status: 'error', message: t('amount', { example: '89006.06' }) };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(openingAsOf)) return { status: 'error', message: t('date') };
  const r = await apiRequest(`/${channel}/account`, 'PATCH', { openingBalance, openingAsOf });
  if (!r.ok) return { status: 'error', message: r.message, problem: r.problem };
  revalidateChannel(channel);
  return { status: 'saved' };
}
