'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { FormDialog, type DialogFormState } from '@/components/form-dialog';
import { ReasonField } from '@/components/reason-field';

/**
 * Cancels or reverses one posted record, asking why. `action` is a server
 * action bound to the record; the dialog stays open with the reason when the
 * system refuses, and its way out reads "Keep it" — never a second "Cancel".
 */
export function CancelAction({
  trigger,
  title,
  description,
  confirmLabel,
  success,
  action,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  success: string;
  action: (prev: DialogFormState, form: FormData) => Promise<DialogFormState>;
  /** Anything to say before the reason — what this will and won't change. */
  children?: ReactNode;
}) {
  const t = useTranslations('corrections');
  return (
    <FormDialog trigger={trigger} title={title} description={description} action={action} submitLabel={confirmLabel} success={success} dismissLabel={t('keep')}>
      {children}
      <ReasonField />
    </FormDialog>
  );
}
