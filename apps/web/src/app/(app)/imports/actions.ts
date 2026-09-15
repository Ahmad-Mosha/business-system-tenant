'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { apiRequest } from '@/lib/api-request';

export interface ImportOutcome {
  importId: string;
  alreadyImported: boolean;
  rowsInFile: number;
  rowsInserted: number;
  rowsSkipped: number;
  unmappedListings: number;
  periodStart: string | null;
  periodEnd: string | null;
}

export type UploadState =
  | { status: 'idle' }
  | { status: 'done'; result: ImportOutcome; filename: string }
  | { status: 'error'; message: string };

/**
 * Forwards the upload to the API. Going through the server keeps the API
 * origin private and means the browser never needs CORS.
 */
export async function uploadReport(
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: (await getTranslations('validation'))('csvFile') };
  }

  const body = new FormData();
  body.append('file', file, file.name);

  // The API returns a readable reason for a malformed file; surface it.
  const r = await apiRequest<ImportOutcome>('/noon/imports', 'POST', body);
  if (!r.ok) return { status: 'error', message: r.message };

  revalidatePath('/');
  revalidatePath('/products');
  revalidatePath('/imports');
  return { status: 'done', result: r.data, filename: file.name };
}
