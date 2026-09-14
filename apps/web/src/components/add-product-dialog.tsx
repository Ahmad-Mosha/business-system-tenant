'use client';

import { useTranslations } from 'next-intl';
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
import { LISTING_CHANNELS } from '@/components/channel-listings';
import { CATEGORIES } from '@/lib/categories';

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
  const t = useTranslations('product.dialog');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
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
  const t = useTranslations('product');
  const tr = useTranslations();
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
        listings: LISTING_CHANNELS.map((c) => ({ channel: c, externalId: channelSkus[c] ?? '' })),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(t('dialog.created'));
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
          <FieldLabel htmlFor="np-name">{t('name')}</FieldLabel>
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
          <FieldLabel>{t('category')}</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={category}
            onValueChange={setCategory}
            disabled={pending}
            aria-label={t('category')}
            className="flex-wrap"
          >
            {CATEGORIES.map((c) => (
              <ToggleGroupItem key={c} value={c}>
                {tr(`enums.category.${c}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="np-sku">
            {t('new.ourSku')} <span className="font-normal text-muted-foreground">{t('dialog.optional')}</span>
          </FieldLabel>
          <Input
            id="np-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder={t('dialog.skuPlaceholder')}
            disabled={pending}
            className="font-mono"
          />
        </Field>
        <FieldSeparator />
        <Field>
          <FieldLabel>{t('new.alsoSoldOn')}</FieldLabel>
          <FieldDescription>{t('dialog.alsoSoldOnHint')}</FieldDescription>
          <div className="grid gap-2">
            {LISTING_CHANNELS.map((c) => (
              <div key={c} className="flex items-center gap-2.5">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">
                  {tr(`enums.channel.${c}`)}
                </span>
                <Input
                  value={channelSkus[c] ?? ''}
                  onChange={(e) => setChannelSkus((s) => ({ ...s, [c]: e.target.value }))}
                  placeholder={t(`channelSku.${c}.placeholder`)}
                  aria-label={t('listings.sku', { channel: tr(`enums.channel.${c}`) })}
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
            {tr('common.cancel')}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? <Spinner /> : null}
          {t('dialog.create')}
        </Button>
      </DialogFooter>
    </form>
  );
}
