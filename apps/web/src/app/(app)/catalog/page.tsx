import { CHANNEL_LABELS, type ListVariantsResponse } from '@app/contracts';
import { apiGet } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Catalog' };

export default async function CatalogPage() {
  await requireUser();
  const { items, total } = await apiGet<ListVariantsResponse>('/catalog/variants?limit=100');

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Catalog</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-2">
          One variant per real product. Every channel listing points back to it, so a
          sale on any channel moves the same stock. Catalog defines{' '}
          <em className="not-italic text-ink">what a product is</em>; the inventory
          slice (not built yet) will track{' '}
          <em className="not-italic text-ink">how many you physically have</em>.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {items.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <p className="text-[16px] font-medium text-ink">No products yet</p>
            <p className="mx-auto mt-2 max-w-sm text-[14px] text-ink-2">
              Import them from a sales channel, or add them here once the catalog editor
              lands.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {items.map((v) => (
              <li key={v.id} className="flex items-center gap-4 px-5 py-4 hover:bg-rail/60">
                <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-rail">
                  {v.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external, unoptimizable channel-hosted image
                    <img
                      src={v.imageUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide text-ink-3">
                      No image
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink" title={v.name}>
                    {v.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="tnum text-[12.5px] font-medium text-ink-2">{v.sku}</span>
                    {v.channels.length === 0 ? (
                      <span className="text-[12px] text-ink-3">Not listed anywhere</span>
                    ) : (
                      v.channels.map((c) => (
                        <span
                          key={c}
                          className="rounded-md bg-mute-bg px-1.5 py-0.5 text-[11px] font-medium text-mute"
                        >
                          {CHANNEL_LABELS[c]}
                        </span>
                      ))
                    )}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="tnum block text-[14px] font-medium text-ink">
                    {v.fromPrice != null
                      ? formatMoney({ amount: v.fromPrice, currency: v.currency })
                      : '—'}
                  </span>
                  <span className="tnum mt-0.5 block text-[12px] text-ink-3">
                    {v.listingCount} {v.listingCount === 1 ? 'listing' : 'listings'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line px-5 py-3 text-[13px] text-ink-3">
          <span className="tnum">{total}</span> variants
        </div>
      </div>
    </div>
  );
}
