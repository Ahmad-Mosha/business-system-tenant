'use client';

import { Check, Link2, Plus, Unlink, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
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
 * The channels a product can be sold on, each with the identifier it needs
 * (`product.channelSku`). `social` isn't here — a social sale is a manual
 * order against the product directly, so it never needs an external id.
 */
export const LISTING_CHANNELS = ['noon', 'amazon', 'easyorders'] as const;
type Channel = (typeof LISTING_CHANNELS)[number];

export function ChannelListings({ product }: { product: ProductDetail }) {
  const t = useTranslations('product.listings');
  // Every product in the catalogue is single-variant today. One that genuinely
  // has variants needs a mapping per variant — not built yet.
  if (product.variants.length > 1) {
    return (
      <p className="border-t px-4 py-8 text-center text-[13px] text-muted-foreground">
        {t('variantsNotBuilt')}
      </p>
    );
  }

  const byChannel = new Map<Channel, Listing[]>(LISTING_CHANNELS.map((c) => [c, []]));
  for (const l of product.listings) byChannel.get(l.channel as Channel)?.push(l);

  return (
    <div className="mt-1 border-t">
      {LISTING_CHANNELS.map((c) => (
        <ChannelSection key={c} productId={product.id} channel={c} listings={byChannel.get(c) ?? []} />
      ))}
      <p className="px-4 py-3 text-xs text-muted-foreground">{t('socialNote')}</p>
    </div>
  );
}

/**
 * One channel's block: every SKU already linked, plus zero or more blank
 * "draft" rows for adding another — a channel can legitimately have more than
 * one SKU pointing at the same variant (e.g. two Amazon listings for the same
 * item). Draft keys are local-only and never touch the server until saved.
 */
function ChannelSection({
  productId,
  channel,
  listings,
}: {
  productId: string;
  channel: Channel;
  listings: Listing[];
}) {
  const t = useTranslations('product');
  const tr = useTranslations();
  const name = tr(`enums.channel.${channel}`);
  const nextDraftId = useRef(1);
  const [drafts, setDrafts] = useState<number[]>(listings.length === 0 ? [0] : []);

  const addDraft = () => {
    const id = nextDraftId.current++;
    setDrafts((d) => [...d, id]);
  };
  const removeDraft = (id: number) => setDrafts((d) => d.filter((x) => x !== id));

  return (
    <div className="border-b px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{name}</span>
        {listings.length > 0 ? (
          <ToneBadge tone="success">{t('listings.linked')}</ToneBadge>
        ) : (
          <ToneBadge tone="neutral">{t('listings.notLinked')}</ToneBadge>
        )}
      </div>
      <div className="mt-2 grid gap-2">
        {listings.map((l) => (
          <ChannelRow key={l.id} productId={productId} channel={channel} listing={l} />
        ))}
        {drafts.map((id) => (
          <ChannelRow
            key={id}
            productId={productId}
            channel={channel}
            listing={null}
            onSaved={() => removeDraft(id)}
            onDiscard={listings.length > 0 || drafts.length > 1 ? () => removeDraft(id) : undefined}
          />
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={addDraft} className="mt-2 h-7 px-2 text-xs text-muted-foreground">
        <Plus className="size-3.5" />
        {t('listings.addAnother')}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">{t(`channelSku.${channel}.hint`)}</p>
    </div>
  );
}

function ChannelRow({
  productId,
  channel,
  listing,
  onSaved,
  onDiscard,
}: {
  productId: string;
  channel: Channel;
  listing: Listing | null;
  /** Called once after a brand-new (draft) listing saves successfully. */
  onSaved?: () => void;
  /** Present only for a draft row that can be discarded unsaved. */
  onDiscard?: () => void;
}) {
  const t = useTranslations('product');
  const tr = useTranslations();
  const name = tr(`enums.channel.${channel}`);
  const [value, setValue] = useState(listing?.externalId ?? '');
  const [pending, start] = useTransition();

  const trimmed = value.trim();
  const linked = Boolean(listing);
  const dirty = listing ? trimmed !== listing.externalId : trimmed.length > 0;

  const save = () =>
    start(async () => {
      const res = listing
        ? await updateListing(productId, listing.id, trimmed)
        : await addListing(productId, channel, trimmed);
      if (res.ok) {
        toast.success(t(linked ? 'listings.skuUpdated' : 'listings.linkedTo', { channel: name }));
        if (!listing) onSaved?.();
      } else toast.error(res.message);
    });

  const unlink = () =>
    start(async () => {
      if (!listing) return;
      const res = await removeListing(productId, listing.id);
      if (res.ok) {
        setValue('');
        toast.success(t('listings.unlinked', { channel: name }));
      } else toast.error(res.message);
    });

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t(`channelSku.${channel}.placeholder`)}
        aria-label={t('listings.sku', { channel: name })}
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
        {linked ? tr('common.save') : t('listings.link')}
      </Button>
      {linked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={unlink}
              disabled={pending}
              aria-label={t('listings.unlink', { channel: name })}
              className="text-muted-foreground hover:bg-destructive-subtle hover:text-destructive"
            >
              <Unlink />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('listings.unlink', { channel: name })}</TooltipContent>
        </Tooltip>
      ) : onDiscard ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onDiscard}
              disabled={pending}
              aria-label={tr('common.cancel')}
              className="text-muted-foreground"
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tr('common.cancel')}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
