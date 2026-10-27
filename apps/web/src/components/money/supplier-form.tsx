'use client';

import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSupplier, createSupplierInline, updateSupplier } from '@/app/(app)/money/actions';
import { FormDialog, type DialogFormState } from '@/components/forms/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/**
 * Adds a supplier — from the suppliers screen, or inline while entering an
 * invoice (`onCreated`) — or, given `supplier`, edits its details.
 */
export function SupplierForm({
  onCreated,
  supplier,
}: {
  onCreated?: (supplier: { id: string; name: string; phone: string | null; note: string | null; active: boolean; createdAt: string }) => void;
  supplier?: { id: string; name: string; phone: string | null; note: string | null };
} = {}) {
  const t = useTranslations('money.suppliers');
  const tr = useTranslations();
  const optional = <span className="font-normal text-muted-foreground">{tr('common.optional')}</span>;
  const editing = !!supplier;
  return (
    <FormDialog
      trigger={
        editing ? (
          <Button type="button" variant="outline">
            <Pencil />
            {t('edit')}
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
        if (editing) return updateSupplier(supplier.id, previous, form);
        if (!onCreated) return createSupplier(previous, form);
        const result = await createSupplierInline(form);
        if (!result.ok) return { status: 'error', message: result.message };
        onCreated(result.data);
        return { status: 'saved' };
      }}
      submitLabel={editing ? tr('common.save') : t('add')}
      success={editing ? t('updated') : t('addedToast')}
    >
      <Field>
        <FieldLabel htmlFor="supplier-name">{t('name')}</FieldLabel>
        <Input id="supplier-name" name="name" dir="auto" defaultValue={supplier?.name} placeholder={t('namePlaceholder')} autoFocus required />
      </Field>
      <Field>
        <FieldLabel htmlFor="supplier-phone">
          {t('columns.phone')} {optional}
        </FieldLabel>
        <Input id="supplier-phone" name="phone" inputMode="tel" dir="ltr" defaultValue={supplier?.phone ?? undefined} placeholder="01…" className="num" />
      </Field>
      <Field>
        <FieldLabel htmlFor="supplier-note">
          {tr('money.vouchers.note')} {optional}
        </FieldLabel>
        <Input id="supplier-note" name="note" dir="auto" defaultValue={supplier?.note ?? undefined} placeholder={t('notePlaceholder')} />
      </Field>
    </FormDialog>
  );
}
