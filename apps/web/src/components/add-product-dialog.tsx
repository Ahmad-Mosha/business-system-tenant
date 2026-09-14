'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createProductForInvoice } from '@/app/(app)/money/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CATEGORIES } from '@/lib/categories';

const CHANNELS = [
  { key: 'noon', label: 'noon', placeholder: 'Partner SKU, e.g. CCC-0001' },
  { key: 'amazon', label: 'Amazon', placeholder: 'Seller SKU' },
  { key: 'easyorders', label: 'Website', placeholder: 'Easy Orders product ID' },
] as const;

/**
 * The Inventory screen's product form — name, category, our SKU, and the
 * channels it also sells on — as a popup, so a purchase invoice for a
 * brand-new product never has to leave the screen. Cost and quantity stay on
 * the invoice line; this only creates the product's identity.
 */
export function AddProductDialog({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onCreated: (variantId: string, label: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">New product</DialogTitle>
          <DialogDescription>Created in Inventory and added to this invoice.</DialogDescription>
        </DialogHeader>
        {/* The dialog unmounts this on close, so every open starts fresh
            from `initialName` — no effect needed to reset it. */}
        <Body initialName={initialName} onCreated={onCreated} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Body({
  initialName,
  onCreated,
  onDone,
}: {
  initialName: string;
  onCreated: (variantId: string, label: string) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [channelSkus, setChannelSkus] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    start(async () => {
      const res = await createProductForInvoice({
        name: trimmed,
        category: category || undefined,
        sku: sku.trim() || undefined,
        listings: CHANNELS.map((c) => ({ channel: c.key, externalId: channelSkus[c.key] ?? '' })),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success('Product created.');
      onCreated(res.variantId, res.label);
      onDone();
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-4"
    >
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="np-name">Name</FieldLabel>
          <Input
            id="np-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir="auto"
            autoFocus
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel>Category</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={category}
            onValueChange={setCategory}
            disabled={pending}
            aria-label="Category"
            className="flex-wrap"
          >
            {CATEGORIES.map((c) => (
              <ToggleGroupItem key={c.value} value={c.value}>
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="np-sku">
            Our SKU <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="np-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Leave blank if none yet"
            disabled={pending}
            className="font-mono"
          />
        </Field>
        <FieldSeparator />
        <Field>
          <FieldLabel>Also sold on</FieldLabel>
          <FieldDescription>Optional — a sale there will move this product’s stock.</FieldDescription>
          <div className="grid gap-2">
            {CHANNELS.map((c) => (
              <div key={c.key} className="flex items-center gap-2.5">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{c.label}</span>
                <Input
                  value={channelSkus[c.key] ?? ''}
                  onChange={(e) => setChannelSkus((s) => ({ ...s, [c.key]: e.target.value }))}
                  placeholder={c.placeholder}
                  aria-label={`${c.label} SKU`}
                  disabled={pending}
                  className="font-mono"
                />
              </div>
            ))}
          </div>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? <Spinner /> : null}
          Create and add
        </Button>
      </DialogFooter>
    </form>
  );
}
