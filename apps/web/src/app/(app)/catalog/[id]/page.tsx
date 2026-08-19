import { CHANNEL_LABELS, type VariantDetail } from '@app/contracts';
import { ArrowLeft, PackageSearch } from 'lucide-react';
import { CHANNEL_TONES } from '@/lib/channel-colors';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiRequestError, apiGet } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Product · PRIME' };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  let variant: VariantDetail;
  try {
    variant = await apiGet<VariantDetail>(`/catalog/variants/${id}`);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link
        href="/catalog"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to catalog
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <div className="flex gap-5 rounded-lg border border-line bg-surface p-5">
            <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-line-soft">
              {variant.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- channel-hosted, not optimizable
                <img src={variant.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <PackageSearch className="size-7 text-ink-3" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tnum rounded-md border border-line bg-line-soft px-2 py-0.5 text-[12px] font-medium text-ink-2">
                  {variant.sku}
                </span>
                {variant.active ? (
                  <span className="rounded-md border border-ok-border bg-ok-bg px-2 py-0.5 text-[11.5px] font-medium text-ok">
                    Active
                  </span>
                ) : (
                  <span className="rounded-md border border-line bg-line-soft px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
                    Inactive
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-[19px] font-bold leading-snug text-ink">{variant.name}</h1>
              <p className="mt-1 text-[12.5px] text-ink-3">
                Added {formatDate(variant.createdAt)}
              </p>
            </div>
          </div>

          <section className="overflow-hidden rounded-lg border border-line bg-surface">
            <header className="border-b border-line px-5 py-3">
              <h2 className="text-[14.5px] font-semibold text-ink">
                Channel listings ({variant.listings.length})
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-2">
                Every listing below points at this one variant, so a sale on any
                channel moves the same stock.
              </p>
            </header>

            {variant.listings.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13.5px] text-ink-2">
                Not listed on any channel yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] table-fixed border-collapse text-left text-[13.5px]">
                  <colgroup>
                    <col className="w-[7.5rem]" />
                    <col />
                    <col className="w-[9rem]" />
                    <col className="w-[5.5rem]" />
                    <col className="w-[8.5rem]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-line bg-line-soft">
                      <Th>Channel</Th>
                      <Th>Listing title</Th>
                      <Th>Channel SKU</Th>
                      <Th numeric>Per unit</Th>
                      <Th numeric>Price</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {variant.listings.map((listing) => (
                      <tr key={listing.id} className="row-hover">
                        <Td>
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium ${CHANNEL_TONES[listing.channel]}`}
                          >
                            {CHANNEL_LABELS[listing.channel]}
                          </span>
                        </Td>
                        <Td>
                          <span className="block truncate text-ink" title={listing.title ?? ''}>
                            {listing.title ?? '—'}
                          </span>
                        </Td>
                        <Td>
                          <span className="tnum text-ink-2">{listing.externalSku ?? '—'}</span>
                        </Td>
                        <Td numeric>
                          <span className="tnum text-ink-2">×{listing.quantityPerUnit}</span>
                        </Td>
                        <Td numeric>
                          <span className="tnum font-medium text-ink">
                            {listing.price != null
                              ? formatMoney({ amount: listing.price, currency: variant.currency })
                              : '—'}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {variant.description ? (
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="mb-2 text-[14.5px] font-semibold text-ink">Description</h2>
              {/* Channel descriptions contain markup; rendered as text, never as HTML. */}
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">
                {stripHtml(variant.description)}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-72">
          <div className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-3 text-[14.5px] font-semibold text-ink">Stock</h2>
            <p className="text-[13px] leading-relaxed text-ink-2">
              Inventory is not built yet. When it lands, on-hand quantity per
              location will show here — this variant is the thing it will count.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Channel descriptions arrive as HTML; show readable text without trusting markup. */
function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3 ${
        numeric ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-3 align-middle ${
        numeric ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </td>
  );
}
