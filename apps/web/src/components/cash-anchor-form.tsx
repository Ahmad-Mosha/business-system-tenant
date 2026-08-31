'use client';

import { Check, Loader2 } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { setCashAnchor, type AnchorState } from '@/app/(app)/finance/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const INITIAL: AnchorState = { status: 'idle' };

export function CashAnchorForm({
  openingBalance,
  openingAsOf,
}: {
  openingBalance: string;
  openingAsOf: string | null;
}) {
  const [state, submit, pending] = useActionState(setCashAnchor, INITIAL);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') toast.success('Opening cash balance updated.');
  }, [state]);

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[150px] flex-1 space-y-1.5">
        <label htmlFor="openingBalance" className="text-xs font-medium text-muted-foreground">
          Cash (EGP)
        </label>
        <Input
          id="openingBalance"
          name="openingBalance"
          inputMode="decimal"
          defaultValue={openingBalance}
          disabled={pending}
          className="tabular-nums"
        />
      </div>
      <div className="min-w-[150px] flex-1 space-y-1.5">
        <label htmlFor="openingAsOf" className="text-xs font-medium text-muted-foreground">
          As of
        </label>
        <Input
          id="openingAsOf"
          name="openingAsOf"
          type="date"
          defaultValue={openingAsOf ?? ''}
          disabled={pending}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="min-w-[92px]">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving
          </>
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
