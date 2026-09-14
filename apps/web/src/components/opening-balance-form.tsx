'use client';

import { AlertTriangle } from 'lucide-react';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { setOpeningBalance, type AnchorState } from '@/app/(app)/months/actions';
import { DatePicker } from '@/components/date-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';

/** The noon balance every later month is measured from. It can be negative. */
export function OpeningBalanceForm({
  openingBalance,
  openingAsOf,
}: {
  openingBalance: string;
  openingAsOf: string | null;
}) {
  const [state, submit, pending] = useActionState<AnchorState, FormData>(async (prev, form) => {
    const next = await setOpeningBalance(prev, form);
    if (next.status === 'saved') toast.success('Opening balance updated.');
    return next;
  }, { status: 'idle' });

  return (
    <form action={submit} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field>
          <FieldLabel htmlFor="openingBalance">Balance</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="openingBalance"
              name="openingBalance"
              inputMode="decimal"
              defaultValue={openingBalance}
              disabled={pending}
              className="num text-end"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>EGP</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="openingAsOf">As of</FieldLabel>
          <DatePicker id="openingAsOf" name="openingAsOf" defaultValue={openingAsOf ?? ''} disabled={pending} />
        </Field>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Spinner /> : null}
          Save
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
