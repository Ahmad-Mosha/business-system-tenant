'use client';
import { useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { recordExpense, voidExpense } from '@/app/(app)/money/expenses/actions';
import { DatePicker, todayISO } from '@/components/date-picker';
import { FormDialog, type DialogFormState } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function ExpenseForm({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const t = useTranslations('expenses');
  const id = useId();
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  return <FormDialog title={t('add')} description={t('hint')} trigger={<Button>{t('add')}</Button>} submitLabel={t('save')} success={t('saved')}
    action={async (_previous: DialogFormState, form: FormData) => {
      const fingerprint = JSON.stringify([...form.entries()]);
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() };
      const result = await recordExpense(attempt.current.id, form);
      if (result.status === 'saved') attempt.current = null;
      return result;
    }}>
    <Field><FieldLabel htmlFor={`${id}-category`}>{t('category')}</FieldLabel><Input id={`${id}-category`} name="category" list={`${id}-categories`} required maxLength={100} dir="auto" placeholder={t('categoryHint')} /><datalist id={`${id}-categories`}>{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist><p className="text-xs text-muted-foreground">{t('categoryHelp')}</p></Field>
    <div className="grid grid-cols-2 gap-3">
      <Field><FieldLabel htmlFor={`${id}-amount`}>{t('amount')}</FieldLabel><Input id={`${id}-amount`} name="amount" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required placeholder="0.00" className="num" /></Field>
      <Field><FieldLabel htmlFor={`${id}-date`}>{t('date')}</FieldLabel><DatePicker id={`${id}-date`} name="spentOn" defaultValue={todayISO()} /></Field>
    </div>
    <Field><FieldLabel htmlFor={`${id}-note`}>{t('note')}</FieldLabel><Input id={`${id}-note`} name="note" maxLength={2000} dir="auto" /></Field>
  </FormDialog>;
}

export function VoidExpense({ id }: { id: string }) {
  const t = useTranslations('expenses');
  return <FormDialog title={t('void')} description={t('voidHint')} trigger={<Button size="sm" variant="ghost">{t('void')}</Button>} submitLabel={t('void')} success={t('voided')}
    action={(_previous: DialogFormState, form: FormData) => voidExpense(id, form)}>
    <Field><FieldLabel htmlFor={`void-${id}`}>{t('reason')}</FieldLabel><Input id={`void-${id}`} name="reason" required maxLength={1000} dir="auto" /></Field>
  </FormDialog>;
}
