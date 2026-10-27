'use client';

import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createCustomer, createCustomerInline, updateCustomer } from '@/app/(app)/sales/actions';
import { FormDialog, type DialogFormState } from '@/components/forms/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { CustomerRow } from '@/lib/api';

/**
 * Adds a customer — from the customers screen, or inline while writing an
 * invoice (`onCreated`) — or, given `customer`, edits their details.
 */
export function CustomerForm({
  onCreated,
  customer,
  compact = false,
}: {
  onCreated?: (customer: CustomerRow) => void;
  customer?: { id: string; name: string; phone: string | null; note: string | null };
  /** An icon button beside a field, where a labelled one would squeeze it. */
  compact?: boolean;
}) {
  const t = useTranslations('customers');
  const tr = useTranslations();
  const optional = <span className="font-normal text-muted-foreground">{tr('common.optional')}</span>;
  const editing = !!customer;
  return (
    <FormDialog
      trigger={
        editing ? (
          <Button type="button" variant="outline">
            <Pencil />
            {t('edit')}
          </Button>
        ) : compact ? (
          <Button type="button" variant="outline" size="icon" aria-label={t('add')} title={t('add')} className="shrink-0">
            <Plus />
          </Button>
        ) : (
          <Button type="button" variant={onCreated ? 'outline' : 'default'}>
            <Plus />
            {t('add')}
          </Button>
        )
      }
      title={editing ? t('editTitle') : t('add')}
      description={editing ? t('editHint') : t('addHint')}
      action={async (previous: DialogFormState, form: FormData): Promise<DialogFormState> => {
        if (editing) return updateCustomer(customer.id, previous, form);
        if (!onCreated) return createCustomer(previous, form);
        const result = await createCustomerInline(form);
        if (!result.ok) return { status: 'error', message: result.message };
        onCreated(result.data);
        return { status: 'saved' };
      }}
      submitLabel={editing ? tr('common.save') : t('add')}
      success={editing ? t('updated') : t('addedToast')}
    >
      <Field>
        <FieldLabel htmlFor="customer-name">{t('name')}</FieldLabel>
        <Input id="customer-name" name="name" dir="auto" defaultValue={customer?.name} placeholder={t('namePlaceholder')} autoFocus required />
      </Field>
      <Field>
        <FieldLabel htmlFor="customer-phone">
          {t('phone')} {optional}
        </FieldLabel>
        <Input id="customer-phone" name="phone" inputMode="tel" dir="ltr" defaultValue={customer?.phone ?? undefined} placeholder="01…" className="num" />
      </Field>
      <Field>
        <FieldLabel htmlFor="customer-note">
          {tr('money.vouchers.note')} {optional}
        </FieldLabel>
        <Input id="customer-note" name="note" dir="auto" defaultValue={customer?.note ?? undefined} placeholder={t('notePlaceholder')} />
      </Field>
    </FormDialog>
  );
}
