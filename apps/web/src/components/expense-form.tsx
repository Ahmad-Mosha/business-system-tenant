'use client';
import { Ban, Pencil } from 'lucide-react';
import { useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { correctExpense, recordExpense, voidExpense } from '@/app/(app)/money/expenses/actions';
import { DatePicker, todayISO } from '@/components/date-picker';
import { FormDialog, type DialogFormState } from '@/components/form-dialog';
import { ReasonField } from '@/components/reason-field';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/money-input';

/** An expense as recorded, to correct: the form opens filled with it. */
interface ExpenseDraft {
  id: string;
  category: string;
  amount: string;
  spentOn: string;
  note: string | null;
}

/**
 * Records an expense — or, given `expense`, corrects one: saving voids the
 * original and records this one in a single step, both kept in the history.
 */
export function ExpenseForm({ categories, expense }: { categories: Array<{ id: string; name: string }>; expense?: ExpenseDraft }) {
  const t = useTranslations('expenses');
  const tc = useTranslations('corrections.expense');
  const id = useId();
  // One submission id per distinct form content: a resend of the same one records it once.
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const trigger = expense ? (
    <Button size="sm" variant="outline"><Pencil />{tc('edit')}</Button>
  ) : (
    <Button>{t('add')}</Button>
  );
  return <FormDialog title={expense ? tc('edit') : t('add')} description={expense ? tc('editHint') : t('hint')} trigger={trigger}
    submitLabel={expense ? tc('save') : t('save')} success={expense ? tc('corrected') : t('saved')}
    action={async (_previous: DialogFormState, form: FormData) => {
      const fingerprint = JSON.stringify([...form.entries()]);
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() };
      const result = expense ? await correctExpense(expense.id, attempt.current.id, form) : await recordExpense(attempt.current.id, form);
      if (result.status === 'saved') attempt.current = null;
      return result;
    }}>
    <Field><FieldLabel htmlFor={`${id}-category`}>{t('category')}</FieldLabel><Input id={`${id}-category`} name="category" list={`${id}-categories`} required maxLength={100} dir="auto" defaultValue={expense?.category} placeholder={t('categoryHint')} /><datalist id={`${id}-categories`}>{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist><p className="text-xs text-muted-foreground">{t('categoryHelp')}</p></Field>
    <div className="grid grid-cols-2 gap-3">
      <Field><FieldLabel htmlFor={`${id}-amount`}>{t('amount')}</FieldLabel><MoneyInput id={`${id}-amount`} name="amount" defaultValue={expense?.amount} /></Field>
      <Field><FieldLabel htmlFor={`${id}-date`}>{t('date')}</FieldLabel><DatePicker id={`${id}-date`} name="spentOn" defaultValue={expense?.spentOn ?? todayISO()} /></Field>
    </div>
    <Field><FieldLabel htmlFor={`${id}-note`}>{t('note')}</FieldLabel><Input id={`${id}-note`} name="note" maxLength={2000} dir="auto" defaultValue={expense?.note ?? undefined} /></Field>
    {expense ? <ReasonField /> : null}
  </FormDialog>;
}

export function VoidExpense({ id }: { id: string }) {
  const t = useTranslations('expenses');
  const tc = useTranslations('corrections');
  return <FormDialog title={t('void')} description={t('voidHint')} trigger={<Button size="sm" variant="outline" className="text-destructive hover:bg-destructive-subtle hover:text-destructive"><Ban />{t('void')}</Button>} submitLabel={t('void')} success={t('voided')}
    dismissLabel={tc('keep')} action={(_previous: DialogFormState, form: FormData) => voidExpense(id, form)}>
    <ReasonField />
  </FormDialog>;
}
