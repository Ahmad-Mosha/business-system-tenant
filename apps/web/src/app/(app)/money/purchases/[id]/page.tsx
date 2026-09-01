import { notFound } from 'next/navigation';
import { PaidChip } from '@/components/paid-chip';
import { PaySupplier } from '@/components/pay-supplier';
import { PostInvoiceButton } from '@/components/post-invoice-button';
import { ContextBar, Panel, Screen, Scroller } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { getPurchase, getSupplier } from '@/lib/api';
import { date, money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const invoice = await getPurchase(id).catch(() => null);
  if (!invoice) notFound();

  const isCredit = invoice.status === 'POSTED' && invoice.payment === 'CREDIT';
  const supplier = isCredit ? await getSupplier(invoice.supplierId).catch(() => null) : null;

  const draft = invoice.status === 'DRAFT';
  const remaining = Number(invoice.landedTotal) - Number(invoice.settledAmount);
  const canPay = isCredit && invoice.paidStatus !== 'PAID' && remaining > 0.005;

  return (
    <Screen>
      <ContextBar
        back="/money/purchases"
        title={`Invoice ${invoice.invoiceNo ?? '(no ref)'}`}
        meta={
          <>
            <bdi>{invoice.supplier.name}</bdi> · {date(invoice.invoiceDate)} ·{' '}
            {invoice.payment === 'CASH' ? 'paid cash' : 'on credit'}
          </>
        }
        figures={<PaidChip status={invoice.paidStatus} />}
        actions={
          draft ? (
            <PostInvoiceButton id={invoice.id} />
          ) : canPay && supplier ? (
            <PaySupplier
              supplierId={invoice.supplierId}
              owed={supplier.balance}
              invoiceId={invoice.id}
              defaultAmount={remaining.toFixed(2)}
              hint={`This invoice has ${money(remaining)} left. ${invoice.supplier.name} is owed ${money(supplier.balance)} across all invoices.`}
              trigger={<Button size="lg">Record payment</Button>}
            />
          ) : undefined
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row">
        <Panel>
          <Scroller>
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-muted/40">
                <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Product</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unit cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Landed unit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-2.5">
                      <bdi>{l.label}</bdi>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.quantity}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(l.unitCost)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {l.landedUnitCost ? money(l.landedUnitCost) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {money(l.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        </Panel>

        <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[320px]">
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-[13px]">
            <Row label="Goods" value={money(invoice.goodsTotal)} muted />
            <Row
              label={`Shipping & customs · ${invoice.allocation === 'BY_VALUE' ? 'by value' : 'per unit'}`}
              value={money(invoice.extraCosts)}
              muted
            />
            <Row label="Landed into stock" value={money(invoice.landedTotal)} strong />
            {!draft && invoice.payment === 'CREDIT' && (
              <>
                <Row label="Paid so far" value={money(invoice.settledAmount)} muted />
                <Row
                  label="Still owed on this invoice"
                  value={money(remaining)}
                  strong
                  tone={remaining > 0.005 ? 'warn' : 'ok'}
                />
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card px-4 py-3 text-[12px] text-muted-foreground">
            {draft ? (
              <>Not posted yet. Posting adds {money(invoice.landedTotal)} of stock and books the money.</>
            ) : invoice.payment === 'CASH' ? (
              <>
                Posted {date(invoice.postedAt)}. {money(invoice.landedTotal)} came out of cash —
                this invoice is settled.
              </>
            ) : invoice.paidStatus === 'PAID' ? (
              <>
                Posted {date(invoice.postedAt)} on credit, and <b className="text-success">fully paid</b>.
              </>
            ) : (
              <>
                Posted {date(invoice.postedAt)} on credit. {money(remaining)} still owed to{' '}
                <bdi>{invoice.supplier.name}</bdi>. Use{' '}
                <b className="text-foreground">Record payment</b> above when you pay them.
              </>
            )}
          </div>
        </aside>
      </div>
    </Screen>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  tone?: 'warn' | 'ok';
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between py-1',
        strong && 'mt-1 border-t border-border pt-2 font-semibold',
      )}
    >
      <span className={cn(muted && 'text-muted-foreground')}>{label}</span>
      <span
        className={cn(
          'tabular-nums',
          tone === 'warn' && 'text-warning',
          tone === 'ok' && 'text-success',
        )}
      >
        {value}
      </span>
    </div>
  );
}
