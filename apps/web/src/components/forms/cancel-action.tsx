'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { FormDialog, type DialogFormState } from '@/components/forms/form-dialog';
import { BlockedDialog } from '@/components/forms/blocked-dialog';
import { ReasonField } from '@/components/forms/reason-field';
import type { Problem } from '@/lib/problem';

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
  reasonLabel,
  dismissLabel,
  blocked,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  success: string;
  action: (prev: DialogFormState, form: FormData) => Promise<DialogFormState>;
  /** Anything to say before the reason — what this will and won't change. */
  children?: ReactNode;
  reasonLabel?: string;
  /** "Keep it" by default — the way out of a cancellation. */
  dismissLabel?: string;
  /**
   * What already stands in the way (the screen's own data): the dialog then
   * explains it — every record, linked — instead of offering a form that
   * could only be refused. The action still checks again when submitted.
   */
  blocked?: Problem | null;
}) {
  const t = useTranslations('corrections');
  if (blocked) return <BlockedDialog trigger={trigger} title={title} problem={blocked} />;
  return (
    <FormDialog trigger={trigger} title={title} description={description} action={action} submitLabel={confirmLabel} success={success} dismissLabel={dismissLabel ?? t('keep')}>
      {children}
      <ReasonField label={reasonLabel} />
    </FormDialog>
  );
}
