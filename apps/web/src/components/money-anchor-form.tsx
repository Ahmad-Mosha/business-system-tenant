'use client';

import { AlertTriangle } from 'lucide-react';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { setAnchor, type FormState } from '@/app/(app)/money/actions';
import { DatePicker, todayISO } from '@/components/date-picker';
import { MoneyInput } from '@/components/money-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';

/** Sets the cash figure the ledger is measured from. Re-runnable — see the API. */
export function MoneyAnchorForm({
  openingBalance,
  openingAsOf,
}: {
  openingBalance: string;
  openingAsOf: string | null;
}) {
  const [state, submit, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const next = await setAnchor(prev, form);
    if (next.status === 'saved') toast.success('Opening balance saved.');
    return next;
  }, { status: 'idle' });

  return (
    <form action={submit} className="grid w-full gap-4 text-start">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="openingBalance">Cash on hand</FieldLabel>
          <MoneyInput
            id="openingBalance"
            name="openingBalance"
            defaultValue={openingBalance === '0' ? '' : openingBalance}
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="openingAsOf">As of</FieldLabel>
          <DatePicker
            id="openingAsOf"
            name="openingAsOf"
            defaultValue={openingAsOf ?? todayISO()}
            disabled={pending}
          />
        </Field>
      </div>
      {state.status === 'error' ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? <Spinner /> : null}
        Start the ledger
      </Button>
    </form>
  );
}
