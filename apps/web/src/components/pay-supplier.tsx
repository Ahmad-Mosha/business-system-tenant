'use client';

import { Loader2 } from 'lucide-react';
import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { paySupplier, type FormState } from '@/app/(app)/money/actions';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const INITIAL: FormState = { status: 'idle' };

export function PaySupplier({
  supplierId,
  owed,
  defaultAmount,
  invoiceId,
  trigger,
  hint,
}: {
  supplierId: string;
  owed: string;
  /** Prefill (e.g. one invoice's total); falls back to the whole balance. */
  defaultAmount?: string;
  /** When set, the payment settles this invoice specifically. */
  invoiceId?: string;
  trigger?: ReactNode;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState(paySupplier, INITIAL);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') {
      toast.success('Payment recorded.');
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" disabled={Number(owed) <= 0}>
            Record payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay supplier</DialogTitle>
          <DialogDescription>
            {hint ?? 'Moves cash out and clears what we owe them.'}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-3">
          <input type="hidden" name="id" value={supplierId} />
          {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}
          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground uppercase">
              Amount (EGP)
            </span>
            <MoneyInput name="amount" defaultValue={defaultAmount ?? owed} autoFocus required />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground uppercase">
              Note (optional)
            </span>
            <Input name="memo" placeholder="against invoice INV-42…" />
          </label>
          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="min-w-[100px]">
              {pending ? <Loader2 className="size-4 animate-spin" /> : 'Pay'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
