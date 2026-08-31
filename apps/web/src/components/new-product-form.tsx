'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { addProduct, type CreateProductState } from '@/app/(app)/inventory/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATEGORIES } from '@/lib/categories';

const INITIAL: CreateProductState = { status: 'idle' };

export function NewProductForm() {
  const [state, submit, pending] = useActionState(addProduct, INITIAL);

  return (
    <form action={submit} className="space-y-5">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required autoFocus disabled={pending} />
      </Field>

      <Field label="Category" htmlFor="category" hint="Optional">
        <select
          id="category"
          name="category"
          disabled={pending}
          defaultValue=""
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <option value="">No category</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Our SKU" htmlFor="sku" hint="Optional">
          <Input id="sku" name="sku" disabled={pending} />
        </Field>
        <Field label="Unit cost (EGP)" htmlFor="unitCost" hint="What we paid">
          <Input id="unitCost" name="unitCost" inputMode="decimal" disabled={pending} className="tabular-nums" />
        </Field>
      </div>

      <Field label="Opening stock" htmlFor="openingStock" hint="Units on hand right now">
        <Input
          id="openingStock"
          name="openingStock"
          inputMode="numeric"
          defaultValue="0"
          disabled={pending}
          className="tabular-nums"
        />
      </Field>

      <p className="text-xs text-muted-foreground">
        No selling price here — price is set per order, since it varies by channel.
      </p>

      {state.status === 'error' && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Adding
          </>
        ) : (
          'Add product'
        )}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
