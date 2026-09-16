'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSupplier, createSupplierInline } from '@/app/(app)/money/actions';
import { FormDialog, type DialogFormState } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function SupplierForm({ onCreated }: { onCreated?: (supplier: { id: string; name: string; phone: string | null; note: string | null; active: boolean; createdAt: string }) => void } = {}) {
  const t = useTranslations('money.suppliers');
  const tr = useTranslations();
  const optional = <span className="font-normal text-muted-foreground">{tr('common.optional')}</span>;
  return (
    <FormDialog
      trigger={
        <Button type="button" variant={onCreated ? 'outline' : 'default'}>
          <Plus />
          {t('add')}
        </Button>
      }
      title={t('add')}
      description={t('addHint')}
      action={async (previous: DialogFormState, form: FormData): Promise<DialogFormState> => {
        if (!onCreated) return createSupplier(previous, form);
        const result = await createSupplierInline(form);
        if (!result.ok) return { status: 'error', message: result.message };
        onCreated(result.data);
        return { status: 'saved' };
      }}
      submitLabel={t('add')}
      success={t('addedToast')}
    >
      <Field>
        <FieldLabel htmlFor="supplier-name">{t('name')}</FieldLabel>
        <Input id="supplier-name" name="name" dir="auto" placeholder={t('namePlaceholder')} autoFocus required />
      </Field>
      <Field>
        <FieldLabel htmlFor="supplier-phone">
          {t('columns.phone')} {optional}
        </FieldLabel>
        <Input id="supplier-phone" name="phone" inputMode="tel" placeholder="01…" className="num" />
      </Field>
      <Field>
        <FieldLabel htmlFor="supplier-note">
          {tr('money.vouchers.note')} {optional}
        </FieldLabel>
        <Input id="supplier-note" name="note" dir="auto" placeholder={t('notePlaceholder')} />
      </Field>
    </FormDialog>
  );
}
