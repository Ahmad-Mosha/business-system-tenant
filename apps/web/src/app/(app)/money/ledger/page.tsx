import { LedgerFilters } from '@/components/ledger-filters';
import { ContextBar, Pagination, Panel, Screen, Scroller } from '@/components/shell';
import { getLedger, getMoneyAccounts } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { kindLabel } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

const PAGE_SIZE = 30;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const code = params.code;
  const from = params.from && ISO.test(params.from) ? params.from : undefined;
  const to = params.to && ISO.test(params.to) ? params.to : undefined;
  const page = Math.max(Number(params.page) || 1, 1);
  const offset = (page - 1) * PAGE_SIZE;

  const query = new URLSearchParams();
  if (code) query.set('code', code);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  query.set('limit', String(PAGE_SIZE));
  query.set('offset', String(offset));

  const [accounts, { entries, total }] = await Promise.all([
    getMoneyAccounts(),
    getLedger(query.toString()),
  ]);

  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const keep = new URLSearchParams();
  if (code) keep.set('code', code);
  if (from) keep.set('from', from);
  if (to) keep.set('to', to);
  const pageHref = (p: number) => {
    const next = new URLSearchParams(keep);
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return qs ? `/money/ledger?${qs}` : '/money/ledger';
  };

  return (
    <Screen>
      <ContextBar title="Ledger" meta="every recorded movement of value" />
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <LedgerFilters accounts={accounts} />

        <Panel>
          <Scroller>
            {entries.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted-foreground">
                Nothing recorded for this view.
              </p>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
                  <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">When</th>
                    <th className="px-4 py-2.5 text-left font-medium">Entry</th>
                    <th className="px-4 py-2.5 text-left font-medium">From → to</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="h-11 border-b border-border/60 last:border-b-0 hover:bg-accent/40"
                    >
                      <td className="px-4 whitespace-nowrap text-muted-foreground">
                        {dateTime(e.occurredAt)}
                      </td>
                      <td className="px-4">
                        <span className="font-medium">{kindLabel(e.kind)}</span>
                        {e.reversesId && (
                          <span className="ms-1.5 rounded border border-border px-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                            reversal
                          </span>
                        )}
                        {e.memo ? <span className="text-muted-foreground"> · {e.memo}</span> : null}
                      </td>
                      <td className="px-4 whitespace-nowrap text-muted-foreground">
                        <bdi>{e.creditAr}</bdi>
                        <span className="mx-1.5 opacity-50">→</span>
                        <bdi>{e.debitAr}</bdi>
                      </td>
                      <td className="px-4 text-right font-medium tabular-nums">{money(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Scroller>
          <Pagination
            from={total === 0 ? 0 : offset + 1}
            to={offset + entries.length}
            total={total}
            noun="entries"
            prevHref={page > 1 ? pageHref(page - 1) : null}
            nextHref={page < lastPage ? pageHref(page + 1) : null}
          />
        </Panel>
      </div>
    </Screen>
  );
}
