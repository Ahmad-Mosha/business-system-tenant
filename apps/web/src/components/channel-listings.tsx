'use client';

import { Check, Link2, Loader2, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addListing, removeListing, updateListing } from '@/app/(app)/inventory/actions';
import type { ProductDetail } from '@/lib/api';
import { cn } from '@/lib/utils';

type Listing = ProductDetail['listings'][number];

/**
 * The channels a product can be sold on, and what identifier each one needs.
 * `social` is not here — a social sale is keyed as a manual order against the
 * product directly, so it never needs an external id to resolve.
 */
const CHANNELS = [
  {
    key: 'noon',
    label: 'noon',
    placeholder: 'Partner SKU, e.g. CCC-0001',
    hint: 'exactly as it appears in the noon settlement report',
  },
  {
    key: 'amazon',
    label: 'Amazon',
    placeholder: 'Seller SKU',
    hint: 'the SKU you set in Seller Central',
  },
  {
    key: 'easyorders',
    label: 'Website',
    placeholder: 'Easy Orders product ID',
    hint: 'from the product’s page in Easy Orders',
  },
] as const;

const field =
  'h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';

export function ChannelListings({ product }: { product: ProductDetail }) {
  // Every product in the catalogue is single-variant today. When one genuinely
  // has variants, each needs its own per-channel mapping — not built yet.
  if (product.variants.length > 1) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">
        This product has variants. Per-variant channel mapping isn’t built yet — say the word when
        you need it.
      </p>
    );
  }

  const byChannel = new Map(product.listings.map((l) => [l.channel, l]));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {CHANNELS.map((c, i) => (
        <ChannelRow
          key={c.key}
          productId={product.id}
          config={c}
          listing={byChannel.get(c.key) ?? null}
          className={i > 0 ? 'border-t border-border' : undefined}
        />
      ))}
      <p className="border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
        Social orders are entered by hand against this product — nothing to set up here.
      </p>
    </div>
  );
}

function ChannelRow({
  productId,
  config,
  listing,
  className,
}: {
  productId: string;
  config: (typeof CHANNELS)[number];
  listing: Listing | null;
  className?: string;
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
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3', className)}>
      <div className="w-20 shrink-0">
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {config.label}
        </span>
      </div>

      <div className="min-w-[180px] flex-1">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={config.placeholder}
          disabled={pending}
          className={field}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dirty && trimmed) save();
          }}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">{config.hint}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty || !trimmed}
          className="inline-flex h-9 min-w-[76px] items-center justify-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : linked ? (
            <>
              <Check className="size-3.5" />
              Save
            </>
          ) : (
            <>
              <Link2 className="size-3.5" />
              Link
            </>
          )}
        </button>
        {linked && (
          <button
            type="button"
            onClick={unlink}
            disabled={pending}
            aria-label={`Unlink from ${config.label}`}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-destructive-subtle hover:text-destructive disabled:opacity-60"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
