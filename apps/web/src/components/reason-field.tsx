'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

/** Why a posted record is being cancelled or corrected — kept on the record, with who and when. */
export function ReasonField() {
  const t = useTranslations('corrections');
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t('reason')}</FieldLabel>
      <Textarea id={id} name="reason" required maxLength={1000} dir="auto" rows={2} placeholder={t('reasonPlaceholder')} />
      <FieldDescription>{t('reasonHint')}</FieldDescription>
    </Field>
  );
}
