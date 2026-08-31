'use client';

import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { archiveProduct, updateProduct } from '@/app/(app)/inventory/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATEGORIES, categoryLabel } from '@/lib/categories';

/**
 * Sits right under the page header, the same slot the order-detail workflow
 * strip uses — this is that pattern applied to a product: identity you can
 * edit, and the one destructive action, both in one compact control.
 */
export function ProductDetailsPanel({
  productId,
  name,
  category,
}: {
  productId: string;
  name: string;
  category: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [archiving, startArchive] = useTransition();
  const [draftName, setDraftName] = useState(name);
  const [draftCategory, setDraftCategory] = useState(category ?? '');

  const save = () =>
    start(async () => {
      const r = await updateProduct(productId, {
        name: draftName.trim(),
        category: draftCategory || null,
      });
      if (r.ok) {
        toast.success('Product updated.');
        setEditing(false);
      } else {
        toast.error(r.message);
      }
    });

  if (editing) {
    return (
      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-border px-5 py-4">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} disabled={pending} />
        </div>
        <div className="w-44 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <select
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="">No category</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={pending || !draftName.trim()}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDraftName(name);
              setDraftCategory(category ?? '');
              setEditing(false);
            }}
          >
            <X className="size-3.5" />
            Cancel
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex items-center justify-between gap-3 rounded-xl border border-border px-5 py-3">
      <p className="text-sm text-muted-foreground">
        Category: <span className="font-medium text-foreground">{categoryLabel(category)}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive-subtle">
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes it from Inventory. Its order and stock history is kept, not
                erased — nothing that already references this product changes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={archiving}
                onClick={(e) => {
                  e.preventDefault();
                  startArchive(async () => {
                    const r = await archiveProduct(productId);
                    if (r && !r.ok) toast.error(r.message);
                  });
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {archiving ? <Loader2 className="size-3.5 animate-spin" /> : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
