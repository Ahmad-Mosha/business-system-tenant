'use client';

import { Loader2 } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { postInvoice, type FormState } from '@/app/(app)/money/actions';
import { Button } from '@/components/ui/button';

const INITIAL: FormState = { status: 'idle' };

/** Posts a draft invoice — the one irreversible step, so it lives on its own. */
export function PostInvoiceButton({ id }: { id: string }) {
  const [state, submit, pending] = useActionState(postInvoice, INITIAL);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') toast.success('Invoice posted — stock and the ledger updated.');
  }, [state]);

  return (
    <form action={submit}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="lg" disabled={pending} className="min-w-[110px]">
        {pending ? <Loader2 className="size-4 animate-spin" /> : 'Post invoice'}
      </Button>
    </form>
  );
}
