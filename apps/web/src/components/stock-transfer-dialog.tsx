'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { transferStock } from '@/app/(app)/inventory/actions';
import { FormDialog, type DialogFormState } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function StockTransferDialog({ variant }: { variant: { id: string; warehouseOnHand: number; noonOnHand: number } }) {
  const t = useTranslations('inventory.transfer');
  const te = useTranslations('enums.stockLocation');
  const [from, setFrom] = useState<'WAREHOUSE' | 'NOON'>('WAREHOUSE');
  const available = Math.max(0, from === 'WAREHOUSE' ? variant.warehouseOnHand : variant.noonOnHand);
  return <FormDialog trigger={<Button variant="outline" className="ms-auto">{t('title')}</Button>} title={t('title')} description={t('description')} submitLabel={t('submit')} success={t('saved')}
    action={async (_previous: DialogFormState, data: FormData): Promise<DialogFormState> => {
      const r = await transferStock(variant.id, Number(data.get('quantity')), from, String(data.get('note') ?? ''));
      return r.ok ? { status: 'saved' } : { status: 'error', message: r.message };
    }}>
    <Field><FieldLabel htmlFor={`from-${variant.id}`}>{t('from')}</FieldLabel><Select value={from} onValueChange={(v) => setFrom(v as typeof from)}><SelectTrigger id={`from-${variant.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WAREHOUSE">{te('WAREHOUSE')}</SelectItem><SelectItem value="NOON">{te('NOON')}</SelectItem></SelectContent></Select></Field>
    <p className="text-sm">{t('destination', { location: te(from === 'WAREHOUSE' ? 'NOON' : 'WAREHOUSE'), available })}</p>
    <Field><FieldLabel htmlFor={`transfer-qty-${variant.id}`}>{t('quantity')}</FieldLabel><Input id={`transfer-qty-${variant.id}`} name="quantity" type="number" min={1} max={available} step={1} required defaultValue={1} className="num" /></Field>
    <Field><FieldLabel htmlFor={`transfer-note-${variant.id}`}>{t('note')}</FieldLabel><Input id={`transfer-note-${variant.id}`} name="note" dir="auto" /></Field>
  </FormDialog>;
}
