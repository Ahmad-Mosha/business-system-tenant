import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PaySupplier } from '@/components/pay-supplier';
import { MetricCard, MetricRow, PageCard, Panel, Screen, Scroller } from '@/components/shell';
import { getSupplier } from '@/lib/api';
import { date, dateTime, money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supplier = await getSupplier(id).catch(() => null);
  if (!supplier) notFound();

  const posted = supplier.invoices.filter((i) => i.status === 'POSTED');
  const purchased = posted.reduce((n, i) => n + Number(i.landedTotal), 0);
  const paid = supplier.payments.reduce((n, p) => n + Number(p.amount), 0);

  return (
    <Screen>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <Link
          href="/money/suppliers"
          className="inline-flex w-fit items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Suppliers
        </Link>

        <PageCard
          title={supplier.name}
          description={supplier.phone ?? supplier.note ?? undefined}
          actions={<PaySupplier supplierId={supplier.id} owed={supplier.balance} />}
        />

        <MetricRow>
          <MetricCard
            label="Balance owed"
            value={money(supplier.balance)}
            tone={Number(supplier.balance) > 0 ? 'warning' : 'default'}
          />
          <MetricCard label="Purchased (posted)" value={money(purchased)} hint={`${posted.length} invoices`} />
          <MetricCard label="Paid" value={money(paid)} hint={`${supplier.payments.length} payments`} />
        </MetricRow>

        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <Panel>
            <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Invoices</div>
            <Scroller>
              {supplier.invoices.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {supplier.invoices.map((i) => (
                      <tr
                        key={i.id}
                        className="group relative border-b border-border/60 last:border-b-0 hover:bg-accent/40"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/money/purchases/${i.id}`}
                            className="font-medium after:absolute after:inset-0"
                          >
                            {i.invoiceNo ?? 'No ref'}
                          </Link>
                          <span className="ms-2 text-muted-foreground">{date(i.invoiceDate)}</span>
                        </td>
                        <td className="px-4 py-2.5">
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
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          {money(i.landedTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Scroller>
          </Panel>

          <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:w-[340px]">
            <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Payments</div>
            <Scroller>
              {supplier.payments.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ul>
                  {supplier.payments.map((p, i) => (
                    <li
                      key={p.id}
                      className={cn('flex items-center gap-3 px-4 py-2.5 text-[13px]', i > 0 && 'border-t border-border/60')}
                    >
                      <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                        {money(p.amount)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {p.memo ?? 'Payment'}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {dateTime(p.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Scroller>
          </aside>
        </div>
      </div>
    </Screen>
  );
}
