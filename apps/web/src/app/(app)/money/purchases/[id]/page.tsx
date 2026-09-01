import { notFound } from 'next/navigation';
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

  const supplier =
    invoice.status === 'POSTED' && invoice.payment === 'CREDIT'
      ? await getSupplier(invoice.supplierId).catch(() => null)
      : null;

  const draft = invoice.status === 'DRAFT';

  return (
    <Screen>
      <ContextBar
        back="/money/purchases"
        title={`Invoice ${invoice.invoiceNo ?? '(no ref)'}`}
        meta={
          <>
            <span dir="rtl">{invoice.supplier.name}</span> · {date(invoice.invoiceDate)} ·{' '}
            {invoice.payment === 'CASH' ? 'paid cash' : 'on credit'} ·{' '}
            <span className={draft ? 'text-warning' : ''}>{invoice.status}</span>
          </>
        }
        actions={
          draft ? (
            <PostInvoiceButton id={invoice.id} />
          ) : supplier && Number(supplier.balance) > 0 ? (
            <PaySupplier
              supplierId={invoice.supplierId}
              owed={supplier.balance}
              defaultAmount={
                Number(invoice.landedTotal) <= Number(supplier.balance)
                  ? invoice.landedTotal
                  : supplier.balance
              }
              hint={`${invoice.supplier.name} is owed ${money(supplier.balance)} in total. Paying reduces that.`}
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
                    <td className="px-4 py-2.5" dir="rtl">
                      {l.label}
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
          </div>

          <div className="rounded-xl border border-border bg-card px-4 py-3 text-[12px] text-muted-foreground">
            {draft ? (
              <>Not posted yet. Posting adds {money(invoice.landedTotal)} of stock and books the money.</>
            ) : invoice.payment === 'CASH' ? (
              <>
                Posted {date(invoice.postedAt)}. {money(invoice.landedTotal)} came out of cash;{' '}
                {invoice.lines.length} stock receipt{invoice.lines.length === 1 ? '' : 's'} added.
              </>
            ) : (
              <>
                Posted {date(invoice.postedAt)} on credit. Added {money(invoice.landedTotal)} to{' '}
                <span dir="rtl">{invoice.supplier.name}</span>’s balance
                {supplier ? <> — now {money(supplier.balance)} owed in total</> : null}. Use{' '}
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
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between py-1',
        strong && 'mt-1 border-t border-border pt-2 font-semibold',
      )}
    >
      <span className={cn(muted && 'text-muted-foreground')}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
