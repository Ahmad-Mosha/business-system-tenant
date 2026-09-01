import Link from 'next/link';
import { Plus } from 'lucide-react';
import { MetricCard, MetricRow, PageCard, Panel, Screen, Scroller } from '@/components/shell';
import { getPurchases } from '@/lib/api';
import { date, money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

/** First day of the current month, ISO. */
function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default async function PurchasesPage() {
  await requireAdmin();
  const invoices = await getPurchases();

  const since = monthStart();
  const postedThisMonth = invoices.filter(
    (i) => i.status === 'POSTED' && i.invoiceDate >= since,
  );
  const monthTotal = postedThisMonth.reduce((n, i) => n + Number(i.landedTotal), 0);
  const drafts = invoices.filter((i) => i.status === 'DRAFT').length;

  return (
    <Screen>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <PageCard
          title="Purchases"
          description="Every فاتورة شراء. Posting one brings goods into stock at landed cost."
          actions={
            <Link
              href="/money/purchases/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Plus className="size-4" /> New invoice
            </Link>
          }
        />

        <MetricRow>
          <MetricCard label="Invoices" value={invoices.length} hint="all time" />
          <MetricCard
            label="This month"
            value={money(monthTotal)}
            hint={`${postedThisMonth.length} posted`}
          />
          <MetricCard label="Drafts" value={drafts} tone={drafts > 0 ? 'warning' : 'default'} hint="not posted" />
        </MetricRow>

        <Panel>
          <Scroller>
            {invoices.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted-foreground">
                No purchase invoices yet.
              </p>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
                  <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">Invoice</th>
                    <th className="px-4 py-2.5 text-left font-medium">Supplier</th>
                    <th className="px-4 py-2.5 text-left font-medium">Date</th>
                    <th className="px-4 py-2.5 text-left font-medium">Payment</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Landed total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr
                      key={i.id}
                      className="group relative h-11 border-b border-border/60 last:border-b-0 hover:bg-accent/40"
                    >
                      <td className="px-4">
                        <Link
                          href={`/money/purchases/${i.id}`}
                          className="font-medium after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                        >
                          {i.invoiceNo ?? <span className="text-muted-foreground">No ref</span>}
                        </Link>
                        <span className="ms-2 text-[11px] text-muted-foreground">{i.lineCount} lines</span>
                      </td>
                      <td className="px-4" dir="rtl">
                        {i.supplierName}
                      </td>
                      <td className="px-4 whitespace-nowrap text-muted-foreground">
                        {date(i.invoiceDate)}
                      </td>
                      <td className="px-4 text-muted-foreground">
                        {i.payment === 'CASH' ? 'Paid cash' : 'On credit'}
                      </td>
                      <td className="px-4">
                        <span
                          className={cn(
                            'rounded border px-1.5 py-0.5 text-[10px] tracking-wide uppercase',
                            i.status === 'POSTED'
                              ? 'border-border text-muted-foreground'
                              : 'border-warning/40 text-warning',
                          )}
                        >
                          {i.status}
                        </span>
                      </td>
                      <td className="px-4 text-right font-medium tabular-nums">{money(i.landedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Scroller>
        </Panel>
      </div>
    </Screen>
  );
}
