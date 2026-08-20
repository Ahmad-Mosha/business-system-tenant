'use server';

import { revalidatePath } from 'next/cache';
import { authHeaders } from '@/lib/session';

const API = process.env.API_URL ?? 'http://localhost:3001';

export interface ImportOutcome {
  importId: string;
  alreadyImported: boolean;
  rowsInFile: number;
  rowsInserted: number;
  rowsSkipped: number;
  productsDiscovered: number;
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
    return { status: 'error', message: 'Choose a CSV file to upload.' };
  }

  const body = new FormData();
  body.append('file', file, file.name);

  let res: Response;
  try {
    res = await fetch(`${API}/noon/imports`, {
      method: 'POST',
      body,
      headers: await authHeaders(),
    });
  } catch {
    return { status: 'error', message: 'Could not reach the API. Is it running?' };
  }

  if (!res.ok) {
    // The API returns a readable reason for a malformed file; surface it.
    const detail = await res.json().catch(() => null);
    return {
      status: 'error',
      message: detail?.message ?? `Upload failed (${res.status}).`,
    };
  }

  const result = (await res.json()) as ImportOutcome;
  revalidatePath('/');
  revalidatePath('/products');
  revalidatePath('/imports');
  return { status: 'done', result, filename: file.name };
}
