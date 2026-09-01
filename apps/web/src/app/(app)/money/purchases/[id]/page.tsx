import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PostInvoiceButton } from '@/components/post-invoice-button';
import { PageCard, Panel, Screen, Scroller } from '@/components/shell';
import { getPurchase } from '@/lib/api';
import { date, money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const invoice = await getPurchase(id).catch(() => null);
  if (!invoice) notFound();

  const draft = invoice.status === 'DRAFT';

  return (
    <Screen>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <Link
          href="/money/purchases"
          className="inline-flex w-fit items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Purchases
        </Link>

        <PageCard
          title={`Invoice ${invoice.invoiceNo ?? '(no ref)'}`}
          description={
            <>
              <span dir="rtl">{invoice.supplier.name}</span> · {date(invoice.invoiceDate)} ·{' '}
              {invoice.payment === 'CASH' ? 'paid cash' : 'on credit'} ·{' '}
              <span className={draft ? 'text-warning' : ''}>{invoice.status}</span>
            </>
          }
          actions={draft ? <PostInvoiceButton id={invoice.id} /> : undefined}
        />

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
                  <tr key={l.id} className="border-b border-border/60">
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
              <tfoot>
                <tr className="text-[13px]">
                  <td className="px-4 py-2 text-right text-muted-foreground" colSpan={4}>
                    Goods
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(invoice.goodsTotal)}</td>
                </tr>
                <tr className="text-[13px]">
                  <td className="px-4 py-2 text-right text-muted-foreground" colSpan={4}>
                    Shipping &amp; customs · allocated {invoice.allocation === 'BY_VALUE' ? 'by value' : 'per unit'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(invoice.extraCosts)}</td>
                </tr>
                <tr className="border-t border-border text-[13px] font-semibold">
                  <td className="px-4 py-2.5 text-right" colSpan={4}>
                    Landed into stock
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(invoice.landedTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Scroller>
          {invoice.status === 'POSTED' && (
            <div className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              Posted {date(invoice.postedAt)} — {invoice.lines.length} stock receipts, one{' '}
              {invoice.payment === 'CASH' ? 'cash' : 'supplier payable'} entry of {money(invoice.landedTotal)}.
            </div>
          )}
        </Panel>
      </div>
    </Screen>
  );
}
