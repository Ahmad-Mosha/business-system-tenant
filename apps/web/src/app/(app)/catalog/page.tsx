import { CHANNEL_LABELS, type ListVariantsResponse } from '@app/contracts';
import { apiGet } from '@/lib/api';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Catalog' };

export default async function CatalogPage() {
  await requireUser();
  const { items, total } = await apiGet<ListVariantsResponse>('/catalog/variants?limit=100');

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Catalog</h1>
        <p className="mt-1 text-[14px] text-ink-2">
          One variant per real product. Every channel listing points back to it, so a sale
          on any channel moves the same stock.
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                    Internal SKU
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                    Product
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                    Sold on
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                    Listings
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.id} className="border-b border-line-soft last:border-0 hover:bg-canvas/50">
                    <td className="tnum px-4 py-3.5 font-medium text-ink">{v.sku}</td>
                    <td className="px-4 py-3.5 text-ink-2">{v.name}</td>
                    <td className="px-4 py-3.5">
                      <span className="flex flex-wrap gap-1.5">
                        {v.channels.length === 0 ? (
                          <span className="text-[13px] text-ink-3">Not listed anywhere</span>
                        ) : (
                          v.channels.map((c) => (
                            <span
                              key={c}
                              className="rounded-md bg-mute-bg px-1.5 py-0.5 text-[12px] font-medium text-mute"
                            >
                              {CHANNEL_LABELS[c]}
                            </span>
                          ))
                        )}
                      </span>
                    </td>
                    <td className="tnum px-4 py-3.5 text-right text-ink-2">{v.listingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-line px-5 py-3 text-[13px] text-ink-3">
          <span className="tnum">{total}</span> variants
        </div>
      </div>
    </div>
  );
}
