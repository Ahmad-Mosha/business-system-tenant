import { ClipboardList, Plus } from 'lucide-react';
import Link from 'next/link';
import { Amount } from '@/components/amount';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPurchases } from '@/lib/api';
import { date, money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default async function PurchasesPage() {
  await requireAdmin();
  const invoices = await getPurchases();

  const since = monthStart();
  const posted = invoices.filter((i) => i.status === 'POSTED');
  const monthTotal = posted
    .filter((i) => String(i.invoiceDate).slice(0, 10) >= since)
    .reduce((n, i) => n + Number(i.landedTotal), 0);
  const drafts = invoices.filter((i) => i.status === 'DRAFT').length;
  // What's still owed on credit invoices — the same derivation supplier
  // balances use, so the two can't disagree.
  const owed = posted
    .filter((i) => i.payment === 'CREDIT')
    .reduce((n, i) => n + Number(i.landedTotal) - Number(i.settledAmount), 0);

  const newInvoice = (
    <Button asChild>
      <Link href="/money/purchases/new">
        <Plus />
        New invoice
      </Link>
    </Button>
  );

  return (
    <Page fill>
      <PageHeader
        title={
          <>
            Purchases <bdi className="font-sans text-lg font-normal text-muted-foreground">فاتورة شراء</bdi>
          </>
        }
        description="Supplier invoices — how stock comes in, at cost."
        actions={newInvoice}
      />

      <MetricGrid>
        <MetricCard label="Bought this month" value={<Amount value={monthTotal} />} hint="Posted invoices, at cost" />
        <MetricCard
          label="Owed on invoices"
          value={<Amount value={owed} />}
          tone={owed > 0.005 ? 'warning' : 'default'}
          hint={owed > 0.005 ? 'Credit invoices not fully paid' : 'Every credit invoice is paid'}
          link={{ href: '/money/suppliers', label: 'Open Suppliers' }}
        />
        <MetricCard
          label="Drafts"
          value={drafts}
          tone={drafts > 0 ? 'warning' : 'default'}
          hint={drafts > 0 ? 'Not posted — stock hasn’t moved' : 'Nothing waiting to post'}
        />
      </MetricGrid>

      <TablePanel
        minWidth="52rem"
        footer={
          <TableCount>
            <span className="num font-medium text-foreground">{invoices.length}</span>{' '}
            {invoices.length === 1 ? 'invoice' : 'invoices'}
          </TableCount>
        }
      >
        {invoices.length === 0 ? (
          <TableEmpty
            icon={ClipboardList}
            title="No purchase invoices yet"
            description="Create one to bring stock in at cost."
            action={newInvoice}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[110px]">Payment</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead className="w-[140px] text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => (
                <TableRow key={i.id} className="relative">
                  <TableCell>
                    <Link
                      href={`/money/purchases/${i.id}`}
                      className="font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {i.invoiceNo ?? <span className="text-muted-foreground">No ref</span>}
                    </Link>
                    <span className="num ms-2 text-xs text-muted-foreground">
                      {i.lineCount} {i.lineCount === 1 ? 'line' : 'lines'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <bdi>{i.supplierName}</bdi>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{date(i.invoiceDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.payment === 'CASH' ? 'Cash' : 'Credit'}
                  </TableCell>
                  <TableCell>
                    <PaidChip status={i.paidStatus} />
                  </TableCell>
                  <TableCell className="num text-right font-medium">{money(i.landedTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
