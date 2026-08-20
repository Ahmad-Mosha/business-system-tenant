import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ChannelBadge } from '@/components/order-status';
import { PageBody, PageHeader, SectionHeading } from '@/components/page-header';
import { VariantPanel } from '@/components/variant-panel';
import { getProductDetail, getStockHistory } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

const CHANNEL_LABELS: Record<string, string> = {
  noon: 'noon',
  easyorders: 'Website',
  amazon: 'Amazon',
  social: 'Social',
};

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const product = await getProductDetail(id).catch(() => null);
  if (!product) notFound();

  // One product usually has one variant, so this is one extra query, not N.
  const history = await Promise.all(
    product.variants.map(async (v) => ({ variantId: v.id, movements: await getStockHistory(v.id) })),
  );

  return (
    <>
      <PageHeader
        title={product.name}
        description={product.category ?? 'Uncategorised'}
        actions={
          <Link
            href="/inventory"
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" />
            All products
          </Link>
        }
      />

      <PageBody>
        <section>
          <SectionHeading
            title="Variants and stock"
            hint={product.variants.length > 1 ? `${product.variants.length} variants` : undefined}
          />
          <div className="space-y-4">
            {product.variants.map((v) => (
              <VariantPanel
                key={v.id}
                variant={v}
                movements={history.find((h) => h.variantId === v.id)?.movements ?? []}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            title="Channel listings"
            hint="how each channel refers to this product"
          />
          {product.listings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
              Not listed on any channel yet. Listings are created when a report is
              imported or the website catalogue is synced.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border">
              {product.listings.map((l, i) => (
                <li
                  key={l.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <span className="w-24 shrink-0 font-medium">
                    <ChannelBadge channel={l.channel} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={l.title ?? ''}>
                    {l.title ?? '—'}
                  </span>
                  <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {l.partnerSku ?? l.externalId}
                  </code>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            These identifiers belong to the channel. The product keeps its own
            identity, so a SKU change or a delisting does not affect stock or order
            history.
          </p>
        </section>
      </PageBody>
    </>
  );
}
