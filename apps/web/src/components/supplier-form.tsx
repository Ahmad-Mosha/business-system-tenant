'use client';

import { Plus } from 'lucide-react';
import { createSupplier } from '@/app/(app)/money/actions';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const optional = <span className="font-normal text-muted-foreground">(optional)</span>;

export function SupplierForm() {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus />
          Add supplier
        </Button>
      }
      title="Add supplier"
      description="Someone we buy stock from. Their balance builds from the invoices you post."
      action={createSupplier}
      submitLabel="Add supplier"
      success="Supplier added."
    >
      <Field>
        <FieldLabel htmlFor="supplier-name">Name</FieldLabel>
        <Input id="supplier-name" name="name" dir="auto" placeholder="e.g. مورد الإسكندرية" autoFocus required />
      </Field>
      <Field>
        <FieldLabel htmlFor="supplier-phone">Phone {optional}</FieldLabel>
        <Input id="supplier-phone" name="phone" inputMode="tel" placeholder="01…" className="num" />
      </Field>
      <Field>
        <FieldLabel htmlFor="supplier-note">Note {optional}</FieldLabel>
        <Input id="supplier-note" name="note" dir="auto" placeholder="What they supply, terms…" />
      </Field>
    </FormDialog>
  );
}
