'use client';

import { Loader2, Minus, Plus } from 'lucide-react';
import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { recordCapital, type CapitalState } from '@/app/(app)/finance/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const INITIAL: CapitalState = { status: 'idle' };

/**
 * Two submit buttons, not a toggle + separate submit: React 19 reads the
 * clicked button's name/value into the form's FormData, so "which direction"
 * and "go" are the same click.
 */
export function CapitalForm() {
  const [state, submit, pending] = useActionState(recordCapital, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') {
      toast.success('Recorded.');
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[140px] flex-1 space-y-1.5">
        <label htmlFor="amount" className="text-xs font-medium text-muted-foreground">
          Amount (EGP)
        </label>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          placeholder="0.00"
          disabled={pending}
          className="tabular-nums"
        />
      </div>
      <div className="min-w-[200px] flex-[2] space-y-1.5">
        <label htmlFor="note" className="text-xs font-medium text-muted-foreground">
          Note (optional)
        </label>
        <Input id="note" name="note" placeholder="e.g. owner top-up" disabled={pending} />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          name="direction"
          value="IN"
          variant="outline"
          disabled={pending}
          className="min-w-[104px]"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Plus className="size-4" />
              Cash in
            </>
          )}
        </Button>
        <Button
          type="submit"
          name="direction"
          value="OUT"
          variant="outline"
          disabled={pending}
          className="min-w-[112px]"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Minus className="size-4" />
              Cash out
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
