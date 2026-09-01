'use client';

import { Loader2, Plus } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createSupplier, type FormState } from '@/app/(app)/money/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const INITIAL: FormState = { status: 'idle' };

export function SupplierForm() {
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState(createSupplier, INITIAL);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') {
      toast.success('Supplier added.');
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="size-4" /> Add supplier
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add supplier</DialogTitle>
        </DialogHeader>
        <form ref={ref} action={submit} className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground uppercase">
              Name
            </span>
            <Input name="name" placeholder="e.g. مورد الإسكندرية" dir="rtl" autoFocus required />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground uppercase">
              Phone (optional)
            </span>
            <Input name="phone" inputMode="tel" placeholder="01…" className="tabular-nums" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground uppercase">
              Note (optional)
            </span>
            <Input name="note" placeholder="what they supply, terms…" />
          </label>
          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="min-w-[90px]">
              {pending ? <Loader2 className="size-4 animate-spin" /> : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
