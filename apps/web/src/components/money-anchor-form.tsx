'use client';

import { Check, Loader2 } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { setAnchor, type FormState } from '@/app/(app)/money/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const INITIAL: FormState = { status: 'idle' };

/** Sets the cash figure the ledger is measured from. Re-runnable — see the API. */
export function MoneyAnchorForm({
  openingBalance,
  openingAsOf,
}: {
  openingBalance: string;
  openingAsOf: string | null;
}) {
  const [state, submit, pending] = useActionState(setAnchor, INITIAL);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') toast.success('Opening balance saved.');
  }, [state]);

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3">
      <label className="min-w-[150px] flex-1 space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Cash on hand (EGP)</span>
        <Input
          name="openingBalance"
          inputMode="decimal"
          defaultValue={openingBalance === '0' ? '' : openingBalance}
          placeholder="0.00"
          disabled={pending}
          className="tabular-nums"
        />
      </label>
      <label className="min-w-[150px] flex-1 space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">As of</span>
        <Input name="openingAsOf" type="date" defaultValue={openingAsOf ?? ''} disabled={pending} />
      </label>
      <Button type="submit" variant="outline" size="lg" disabled={pending} className="min-w-[96px]">
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : state.status === 'saved' ? (
          <>
            <Check className="size-4 text-success" />
            Saved
          </>
        ) : (
          'Save'
        )}
      </Button>
    </form>
  );
}
