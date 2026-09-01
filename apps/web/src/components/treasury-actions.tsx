'use client';

import { ArrowDownLeft, ArrowUpRight, Banknote, FileText, Loader2 } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { recordCheque, recordVoucher, type FormState } from '@/app/(app)/money/actions';
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
import { VOUCHER_COUNTERS } from '@/lib/money';

const INITIAL: FormState = { status: 'idle' };
const todayISO = () => new Date().toISOString().slice(0, 10);

export function TreasuryActions() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <VoucherDialog
        kind="deposit"
        trigger={
          <Button variant="default" size="lg">
            <Banknote className="size-4" /> Cash deposit
          </Button>
        }
      />
      <VoucherDialog
        kind="in"
        trigger={
          <Button variant="outline" size="lg">
            <ArrowDownLeft className="size-4" /> Cash in
          </Button>
        }
      />
      <VoucherDialog
        kind="out"
        trigger={
          <Button variant="outline" size="lg">
            <ArrowUpRight className="size-4" /> Cash out
          </Button>
        }
      />
      <ChequeDialog
        trigger={
          <Button variant="outline" size="lg">
            <FileText className="size-4" /> Cheque
          </Button>
        }
      />
    </div>
  );
}

const VOUCHER_COPY = {
  deposit: {
    title: 'Cash deposit — إيداع نقدي',
    description: 'Money an owner puts into the business, as cash.',
    direction: 'IN' as const,
    fixedCounter: 'OWNER_CAPITAL',
  },
  in: {
    title: 'Cash in — سند قبض',
    description: 'Money received for any reason that isn’t a sale or a payout.',
    direction: 'IN' as const,
    fixedCounter: null,
  },
  out: {
    title: 'Cash out — سند صرف',
    description: 'An expense paid from cash, or an owner withdrawal.',
    direction: 'OUT' as const,
    fixedCounter: null,
  },
};

function VoucherDialog({
  kind,
  trigger,
}: {
  kind: 'deposit' | 'in' | 'out';
  trigger: React.ReactNode;
}) {
  const copy = VOUCHER_COPY[kind];
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState(recordVoucher, INITIAL);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') {
      toast.success('Recorded.');
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-3">
          <input type="hidden" name="direction" value={copy.direction} />
          {copy.fixedCounter && <input type="hidden" name="counter" value={copy.fixedCounter} />}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (EGP)">
              <Input name="amount" inputMode="decimal" placeholder="0.00" className="tabular-nums" autoFocus required />
            </Field>
            <Field label="Date">
              <Input name="occurredAt" type="date" defaultValue={todayISO()} />
            </Field>
          </div>

          {!copy.fixedCounter && (
            <Field label={copy.direction === 'OUT' ? 'What it’s for' : 'Source'}>
              <select
                name="counter"
                required
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Choose…</option>
                {VOUCHER_COUNTERS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Note (optional)">
            <Input name="memo" placeholder="e.g. Bosta August pickup fees" />
          </Field>

          <FormFooter pending={pending} label="Record" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChequeDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState(recordCheque, INITIAL);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'saved') {
      toast.success('Cheque recorded — held pending until it clears.');
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cheque deposit — إيداع سندي</DialogTitle>
          <DialogDescription>
            A cheque received. It sits in “Cheques pending” — not counted as cash until it clears.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (EGP)">
              <Input name="amount" inputMode="decimal" placeholder="0.00" className="tabular-nums" autoFocus required />
            </Field>
            <Field label="From">
              <Input name="fromParty" placeholder="e.g. الشريك أحمد" required />
            </Field>
            <Field label="Received">
              <Input name="receivedDate" type="date" defaultValue={todayISO()} required />
            </Field>
            <Field label="Due (optional)">
              <Input name="dueDate" type="date" />
            </Field>
          </div>
          <Field label="Note (optional)">
            <Input name="memo" placeholder="cheque number, bank…" />
          </Field>
          <FormFooter pending={pending} label="Record cheque" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-medium tracking-[0.03em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function FormFooter({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="mt-1 flex items-center justify-end gap-2">
      <DialogClose asChild>
        <Button type="button" variant="ghost" size="lg" disabled={pending}>
          Cancel
        </Button>
      </DialogClose>
      <Button type="submit" size="lg" disabled={pending} className="min-w-[110px]">
        {pending ? <Loader2 className="size-4 animate-spin" /> : label}
      </Button>
    </div>
  );
}
