'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createProductForInvoice } from '@/app/(app)/money/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CATEGORIES } from '@/lib/categories';
import { cn } from '@/lib/utils';

const label = 'text-[11px] font-medium tracking-[0.03em] text-muted-foreground uppercase';
const CHANNELS = [
  { key: 'noon', label: 'noon', placeholder: 'Partner SKU, e.g. CCC-0001' },
  { key: 'amazon', label: 'Amazon', placeholder: 'Seller SKU' },
  { key: 'easyorders', label: 'Website', placeholder: 'Easy Orders product ID' },
] as const;

/**
 * The same product-creation form as the Inventory screen — name, category,
 * our SKU, and the channels it also sells on — as a popup, so building a
 * purchase invoice for a brand-new product never has to leave the screen.
 *
 * Controlled from outside (`open`/`onOpenChange`): it's triggered from within
 * the invoice's product picker, not by its own button. Cost and quantity stay
 * on the invoice line, not here — this only creates the product identity.
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
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [channelSkus, setChannelSkus] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  // Re-seed the name (and clear everything else) every time it's opened fresh.
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setCategory('');
    setSku('');
    setChannelSkus({});
  }, [open, initialName]);

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
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className={label}>Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              dir="rtl"
              autoFocus
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </label>

          <div>
            <p className={cn(label, 'mb-1.5')}>Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(category === c.value ? '' : c.value)}
                  disabled={pending}
                  className={cn(
                    'h-7 rounded-md border px-2.5 text-[12px] transition-colors',
                    category === c.value
                      ? 'border-foreground bg-foreground font-medium text-background'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className={label}>Our SKU (optional)</span>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="leave blank if none yet"
              disabled={pending}
              className="font-mono"
            />
          </label>

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-[11px] text-muted-foreground">
              Also sold on (optional) — a sale there will move this product’s stock.
            </p>
            <div className="space-y-2">
              {CHANNELS.map((c) => (
                <div key={c.key} className="flex items-center gap-2.5">
                  <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{c.label}</span>
                  <Input
                    value={channelSkus[c.key] ?? ''}
                    onChange={(e) => setChannelSkus((s) => ({ ...s, [c.key]: e.target.value }))}
                    placeholder={c.placeholder}
                    disabled={pending}
                    className="font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" size="lg" onClick={submit} disabled={pending || !name.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : 'Create & add'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
