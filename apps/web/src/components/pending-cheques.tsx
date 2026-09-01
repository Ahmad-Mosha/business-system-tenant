'use client';

import { Loader2 } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { settleCheque, type FormState } from '@/app/(app)/money/actions';
import type { ChequeRow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { date, money } from '@/lib/format';

const INITIAL: FormState = { status: 'idle' };

/** The pending cheques strip on the Treasury screen — clear or bounce each one. */
export function PendingCheques({ cheques }: { cheques: ChequeRow[] }) {
  if (cheques.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <div className="border-b border-border px-4 py-2 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        Cheques pending · {cheques.length}
      </div>
      <ul>
        {cheques.map((c, i) => (
          <li
            key={c.id}
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-[13px] ${
              i > 0 ? 'border-t border-border/60' : ''
            }`}
          >
            <span className="w-24 shrink-0 text-right font-medium tabular-nums">{money(c.amount)}</span>
            <span className="min-w-0 flex-1 truncate">
              <span dir="rtl">{c.fromParty}</span>
              {c.memo ? <span className="text-muted-foreground"> · {c.memo}</span> : null}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {c.dueDate ? `due ${date(c.dueDate)}` : `received ${date(c.receivedDate)}`}
            </span>
            <ChequeActions id={c.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChequeActions({ id }: { id: string }) {
  const [state, submit, pending] = useActionState(settleCheque, INITIAL);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') toast.success('Cheque updated.');
  }, [state]);

  return (
    <form action={submit} className="flex shrink-0 items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="status" value="CLEARED" size="sm" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : 'Cleared'}
      </Button>
      <Button
        type="submit"
        name="status"
        value="BOUNCED"
        size="sm"
        variant="ghost"
        disabled={pending}
        className="text-muted-foreground"
      >
        Bounced
      </Button>
    </form>
  );
}
