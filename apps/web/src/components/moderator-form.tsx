'use client';

import { Loader2, UserPlus } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { addModerator, type ModeratorFormState } from '@/app/(app)/team/actions';
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

const INITIAL: ModeratorFormState = { status: 'idle' };

const label = 'text-[11px] font-medium tracking-[0.03em] text-muted-foreground uppercase';

export function ModeratorForm() {
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState(addModerator, INITIAL);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') {
      toast.success(state.message);
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <UserPlus className="size-4" /> Add moderator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add moderator</DialogTitle>
        </DialogHeader>
        <form ref={ref} action={submit} className="grid gap-3">
          <label className="grid gap-1.5">
            <span className={label}>Name</span>
            <Input name="name" placeholder="e.g. Aya" autoFocus required />
          </label>
          <label className="grid gap-1.5">
            <span className={label}>Email</span>
            <Input name="email" type="email" placeholder="aya@prime.com" required />
          </label>
          <label className="grid gap-1.5">
            <span className={label}>Password</span>
            <Input name="password" type="text" placeholder="at least 6 characters" required minLength={6} />
            <span className="text-[11px] text-muted-foreground">
              Share this with them — they sign in with it directly.
            </span>
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
