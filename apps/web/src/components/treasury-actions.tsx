'use client';

import { ArrowDownLeft, ArrowUpRight, Banknote, FileText } from 'lucide-react';
import { recordCheque, recordVoucher } from '@/app/(app)/money/actions';
import { DatePicker } from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VOUCHER_COUNTERS } from '@/lib/money';

const todayISO = () => new Date().toISOString().slice(0, 10);

const VOUCHERS = {
  deposit: {
    title: 'Cash deposit — إيداع نقدي',
    description: 'Money an owner puts into the business, as cash.',
    direction: 'IN',
    fixedCounter: 'OWNER_CAPITAL',
  },
  in: {
    title: 'Cash in — سند قبض',
    description: 'Money received for any reason that isn’t a sale or a payout.',
    direction: 'IN',
    fixedCounter: null,
  },
  out: {
    title: 'Cash out — سند صرف',
    description: 'An expense paid from cash, or an owner withdrawal.',
    direction: 'OUT',
    fixedCounter: null,
  },
} as const;

/** Every hand-entered cash movement, as the Treasury screen's actions. */
export function TreasuryActions() {
  return (
    <>
      <ChequeDialog
        trigger={
          <Button variant="outline">
            <FileText />
            Cheque
          </Button>
        }
      />
      <VoucherDialog
        kind="out"
        trigger={
          <Button variant="outline">
            <ArrowUpRight />
            Cash out
          </Button>
        }
      />
      <VoucherDialog
        kind="in"
        trigger={
          <Button variant="outline">
            <ArrowDownLeft />
            Cash in
          </Button>
        }
      />
      <VoucherDialog
        kind="deposit"
        trigger={
          <Button>
            <Banknote />
            Cash deposit
          </Button>
        }
      />
    </>
  );
}

function VoucherDialog({ kind, trigger }: { kind: keyof typeof VOUCHERS; trigger: React.ReactNode }) {
  const v = VOUCHERS[kind];
  return (
    <FormDialog
      trigger={trigger}
      title={v.title}
      description={v.description}
      action={recordVoucher}
      submitLabel="Record"
      success="Recorded."
    >
      <input type="hidden" name="direction" value={v.direction} />
      {v.fixedCounter ? <input type="hidden" name="counter" value={v.fixedCounter} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={`${kind}-amount`}>Amount</FieldLabel>
          <MoneyInput id={`${kind}-amount`} name="amount" autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${kind}-date`}>Date</FieldLabel>
          <DatePicker id={`${kind}-date`} name="occurredAt" defaultValue={todayISO()} />
        </Field>
      </div>

      {!v.fixedCounter ? (
        <Field>
          <FieldLabel htmlFor={`${kind}-counter`}>
            {v.direction === 'OUT' ? 'What it’s for' : 'Source'}
          </FieldLabel>
          <Select name="counter">
            <SelectTrigger id={`${kind}-counter`} className="w-full">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent position="popper">
              {VOUCHER_COUNTERS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <Field>
        <FieldLabel htmlFor={`${kind}-memo`}>
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input id={`${kind}-memo`} name="memo" dir="auto" placeholder="e.g. Bosta August pickup fees" />
      </Field>
    </FormDialog>
  );
}

function ChequeDialog({ trigger }: { trigger: React.ReactNode }) {
  return (
    <FormDialog
      trigger={trigger}
      title="Cheque deposit — إيداع سندي"
      description="A cheque received. It sits in “Cheques pending” — not counted as cash until it clears."
      action={recordCheque}
      submitLabel="Record cheque"
      success="Cheque recorded — held pending until it clears."
    >
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="cheque-amount">Amount</FieldLabel>
          <MoneyInput id="cheque-amount" name="amount" autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="cheque-from">From</FieldLabel>
          <Input id="cheque-from" name="fromParty" dir="auto" placeholder="e.g. الشريك أحمد" />
        </Field>
        <Field>
          <FieldLabel htmlFor="cheque-received">Received</FieldLabel>
          <DatePicker id="cheque-received" name="receivedDate" defaultValue={todayISO()} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cheque-due">
            Due <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <DatePicker id="cheque-due" name="dueDate" placeholder="No due date" />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="cheque-memo">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input id="cheque-memo" name="memo" placeholder="Cheque number, bank…" />
      </Field>
    </FormDialog>
  );
}
