import { X } from 'lucide-react';
import Link from 'next/link';
import { Status } from '@/components/ui/status';
import type { ProductDetail } from '@/lib/catalogue';
import { CATEGORY_LABELS } from '@/lib/catalogue';

/**
 * The detail panel exists to do the one job the table cannot: show what each
 * channel calls this product, and make a missing mapping obvious. A panel that
 * only repeated the row would not be worth the space.
 */
export function ProductDetail({
  product,
  closeHref,
}: {
  product: ProductDetail;
  closeHref: string;
}) {
  const unmapped = product.listingCount === 0;

  return (
    <aside className="flex w-[22rem] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface">
      <header className="sticky top-0 flex items-start justify-between gap-2 border-b border-line bg-surface px-3 py-2.5">
        <div className="min-w-0">
          <h2 dir="auto" className="text-sm leading-tight font-semibold text-ink">
            {product.name}
          </h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {CATEGORY_LABELS[product.category].en} · {CATEGORY_LABELS[product.category].ar}
          </p>
        </div>
        <Link
          href={closeHref}
          aria-label="Close details"
          scroll={false}
          className="-mr-1 rounded p-1 text-ink-faint hover:bg-raised hover:text-ink"
        >
          <X size={14} />
        </Link>
      </header>

      <section className="border-b border-line px-3 py-2.5">
        <h3 className="label-caps mb-1.5">Channel mapping</h3>

        {unmapped ? (
          <div className="flex flex-col gap-1.5">
            <Status tone="warn">Not on any channel</Status>
            <p className="text-xs text-ink-soft">
              Nothing arriving from noon, Amazon or the website can attach to this product until a
              channel identifier is mapped to it.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {product.variants.flatMap((v) =>
              v.listings.map((l) => (
                <li key={l.id} className="rounded-[3px] border border-line px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Status tone="accent">{l.channel}</Status>
                    {l.label && (
                      <span className="truncate text-xs text-ink-faint" title={l.label}>
                        {l.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[11px] break-all text-ink-soft">
                    {l.externalId}
                  </p>
                  {l.externalVariantId && (
                    <p className="font-mono text-[11px] break-all text-ink-faint">
                      {l.externalVariantId}
                    </p>
                  )}
                </li>
              )),
            )}
          </ul>
        )}
      </section>

      <section className="border-b border-line px-3 py-2.5">
        <h3 className="label-caps mb-1.5">Variants</h3>
        <ul className="flex flex-col gap-1">
          {product.variants.map((v, i) => {
            const attrs = Object.entries(v.attributes);
            return (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-[3px] bg-raised px-2 py-1.5"
              >
                <span dir="auto" className="text-data text-ink">
                  {attrs.length
                    ? attrs.map(([k, val]) => `${k}: ${val}`).join(' · ')
                    : `Default${product.variants.length > 1 ? ` ${i + 1}` : ''}`}
                </span>
                {v.code && <span className="font-mono text-[11px] text-ink-faint">{v.code}</span>}
              </li>
            );
          })}
        </ul>
        {product.variants.length === 1 &&
          !Object.keys(product.variants[0].attributes).length && (
            <p className="mt-1.5 text-xs text-ink-faint">
              No sizes or colours. The single variant is what holds stock.
            </p>
          )}
      </section>

      <section className="px-3 py-2.5">
        <h3 className="label-caps mb-1.5">Stock</h3>
        <p className="text-xs text-ink-soft">
          Stock arrives with the ledger — quantities, locations and movement history. Nothing is
          counted yet.
        </p>
      </section>
    </aside>
  );
}
