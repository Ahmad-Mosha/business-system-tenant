'use client';

import { Banknote } from 'lucide-react';
import type { ReactNode } from 'react';
import { paySupplier } from '@/app/(app)/money/actions';
import { FormDialog } from '@/components/form-dialog';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { money } from '@/lib/format';

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
  /** Prefill (e.g. one invoice's remainder); falls back to the whole balance. */
  defaultAmount?: string;
  /** When set, the payment settles this invoice specifically. */
  invoiceId?: string;
  trigger?: ReactNode;
  hint?: string;
}) {
  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button disabled={Number(owed) <= 0}>
            <Banknote />
            Record payment
          </Button>
        )
      }
      title="Pay supplier"
      description={hint ?? 'Moves cash out of the till and clears what we owe them.'}
      action={paySupplier}
      submitLabel="Record payment"
      success="Payment recorded."
    >
      <input type="hidden" name="id" value={supplierId} />
      {invoiceId ? <input type="hidden" name="invoiceId" value={invoiceId} /> : null}
      <Field>
        <FieldLabel htmlFor="pay-amount">Amount</FieldLabel>
        <MoneyInput id="pay-amount" name="amount" defaultValue={defaultAmount ?? owed} autoFocus />
        <FieldDescription>
          Owed in total: <span className="num text-foreground">{money(owed)}</span> — a payment can’t
          exceed it.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="pay-memo">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input id="pay-memo" name="memo" placeholder="e.g. against invoice INV-42" />
      </Field>
    </FormDialog>
  );
}
