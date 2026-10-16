'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { setOpeningBalance, type AnchorState } from '@/app/(app)/channel-actions';
import type { Marketplace } from '@/lib/channels';
import { DatePicker } from '@/components/date-picker';
import { MoneyInput } from '@/components/money-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';

/** The balance a marketplace owed before the earliest report. It can be negative. */
export function OpeningBalanceForm({
  channel,
  openingBalance,
  openingAsOf,
}: {
  channel: Marketplace;
  openingBalance: string;
  openingAsOf: string | null;
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState<AnchorState, FormData>(async (prev, form) => {
    const next = await setOpeningBalance(channel, prev, form);
    if (next.status === 'saved') toast.success(t('channel.opening.saved'));
    return next;
  }, { status: 'idle' });

  return (
    <form action={submit} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field>
          <FieldLabel htmlFor="openingBalance">{t('channel.opening.balance')}</FieldLabel>
          <MoneyInput
            id="openingBalance"
            name="openingBalance"
            defaultValue={openingBalance}
            placeholder=""
            disabled={pending}
            negative
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="openingAsOf">{t('money.start.asOf')}</FieldLabel>
          <DatePicker id="openingAsOf" name="openingAsOf" defaultValue={openingAsOf ?? ''} disabled={pending} />
        </Field>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Spinner /> : null}
          {t('common.save')}
        </Button>
      </div>
      {state.status === 'error' ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
