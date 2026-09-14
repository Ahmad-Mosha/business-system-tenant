import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Amount } from '@/components/amount';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { PaySupplier } from '@/components/pay-supplier';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSupplier } from '@/lib/api';
import { date, dateTime, money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supplier = await getSupplier(id).catch(() => null);
  if (!supplier) notFound();

  const posted = supplier.invoices.filter((i) => i.status === 'POSTED');
  const purchased = posted.reduce((n, i) => n + Number(i.landedTotal), 0);
  const paid = supplier.payments.reduce((n, p) => n + Number(p.amount), 0);
  const owed = Number(supplier.balance);

  return (
    <Page>
      <PageHeader
        back={{ href: '/money/suppliers', label: 'Back to suppliers' }}
        title={<bdi>{supplier.name}</bdi>}
        description={
          [supplier.phone, supplier.note].filter(Boolean).join(' · ') || 'Supplier'
        }
        actions={<PaySupplier supplierId={supplier.id} owed={supplier.balance} />}
      />

      <MetricGrid>
        <MetricCard
          label="Owed"
          value={<Amount value={supplier.balance} />}
          tone={owed > 0 ? 'warning' : 'default'}
          hint={owed > 0 ? 'On posted credit invoices' : 'Fully settled'}
        />
        <MetricCard
          label="Bought"
          value={<Amount value={purchased} />}
          hint={`${posted.length} posted ${posted.length === 1 ? 'invoice' : 'invoices'}`}
        />
        <MetricCard
          label="Paid"
          value={<Amount value={paid} />}
          hint={`${supplier.payments.length} ${supplier.payments.length === 1 ? 'payment' : 'payments'}`}
        />
      </MetricGrid>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="min-w-0 pb-0">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          {supplier.invoices.length === 0 ? (
            <p className="border-t p-10 text-center text-[13px] text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[140px] text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.invoices.map((i) => (
                  <TableRow key={i.id} className="relative">
                    <TableCell>
                      <Link
                        href={`/money/purchases/${i.id}`}
                        className="font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {i.invoiceNo ?? 'No ref'}
                      </Link>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {i.payment === 'CASH' ? 'Cash' : 'Credit'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{date(i.invoiceDate)}</TableCell>
                    <TableCell>
                      <PaidChip status={i.paidStatus} />
                    </TableCell>
                    <TableCell className="num text-right font-medium">{money(i.landedTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="pb-0">
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>Cash paid to them, newest first.</CardDescription>
          </CardHeader>
          {supplier.payments.length === 0 ? (
            <p className="border-t p-10 text-center text-[13px] text-muted-foreground">No payments yet.</p>
          ) : (
            <Table>
              <TableBody>
                {supplier.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="num w-[130px] text-right font-medium text-destructive">
                      −{money(p.amount)}
                    </TableCell>
                    <TableCell className="max-w-0 truncate text-muted-foreground">{p.memo ?? 'Payment'}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {dateTime(p.occurredAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </Page>
  );
}
