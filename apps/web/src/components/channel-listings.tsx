'use client';

import { Check, Link2, Unlink } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addListing, removeListing, updateListing } from '@/app/(app)/inventory/actions';
import { ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ProductDetail } from '@/lib/api';

type Listing = ProductDetail['listings'][number];

/**
 * The channels a product can be sold on, and the identifier each one needs.
 * `social` isn't here — a social sale is a manual order against the product
 * directly, so it never needs an external id to resolve.
 */
const CHANNELS = [
  {
    key: 'noon',
    label: 'noon',
    placeholder: 'Partner SKU, e.g. CCC-0001',
    hint: 'Exactly as it appears in the noon settlement report',
  },
  {
    key: 'amazon',
    label: 'Amazon',
    placeholder: 'Seller SKU',
    hint: 'The SKU you set in Seller Central',
  },
  {
    key: 'easyorders',
    label: 'Website',
    placeholder: 'Easy Orders product ID',
    hint: 'From the product’s page in Easy Orders',
  },
] as const;

export function ChannelListings({ product }: { product: ProductDetail }) {
  // Every product in the catalogue is single-variant today. One that genuinely
  // has variants needs a mapping per variant — not built yet.
  if (product.variants.length > 1) {
    return (
      <p className="border-t px-4 py-8 text-center text-[13px] text-muted-foreground">
        This product has variants. Per-variant channel mapping isn’t built yet — say the word when
        you need it.
      </p>
    );
  }

  const byChannel = new Map(product.listings.map((l) => [l.channel, l]));

  return (
    <div className="mt-1 border-t">
      {CHANNELS.map((c) => (
        <ChannelRow
          key={c.key}
          productId={product.id}
          config={c}
          listing={byChannel.get(c.key) ?? null}
        />
      ))}
      <p className="px-4 py-3 text-xs text-muted-foreground">
        Social orders are entered by hand against this product — nothing to set up here.
      </p>
    </div>
  );
}

function ChannelRow({
  productId,
  config,
  listing,
}: {
  productId: string;
  config: (typeof CHANNELS)[number];
  listing: Listing | null;
}) {
  const [value, setValue] = useState(listing?.externalId ?? '');
  const [pending, start] = useTransition();

  const trimmed = value.trim();
  const linked = Boolean(listing);
  const dirty = linked ? trimmed !== listing!.externalId : trimmed.length > 0;

  const save = () =>
    start(async () => {
      const res = listing
        ? await updateListing(productId, listing.id, trimmed)
        : await addListing(productId, config.key, trimmed);
      if (res.ok) toast.success(linked ? `${config.label} SKU updated.` : `Linked to ${config.label}.`);
      else toast.error(res.message);
    });

  const unlink = () =>
    start(async () => {
      if (!listing) return;
      const res = await removeListing(productId, listing.id);
      if (res.ok) {
        setValue('');
        toast.success(`Unlinked from ${config.label}.`);
      } else toast.error(res.message);
    });

  return (
    <div className="grid gap-2 border-b px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{config.label}</span>
        {linked ? <ToneBadge tone="success">Linked</ToneBadge> : <ToneBadge tone="neutral">Not linked</ToneBadge>}
      </div>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={config.placeholder}
          aria-label={`${config.label} SKU`}
          disabled={pending}
          className="font-mono"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dirty && trimmed) save();
          }}
        />
        <Button
          variant="outline"
          onClick={save}
          disabled={pending || !dirty || !trimmed}
          className="min-w-20"
        >
          {pending ? <Spinner /> : linked ? <Check /> : <Link2 />}
          {linked ? 'Save' : 'Link'}
        </Button>
        {linked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={unlink}
                disabled={pending}
                aria-label={`Unlink from ${config.label}`}
                className="text-muted-foreground hover:bg-destructive-subtle hover:text-destructive"
              >
                <Unlink />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Unlink from {config.label}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{config.hint}</p>
    </div>
  );
}
