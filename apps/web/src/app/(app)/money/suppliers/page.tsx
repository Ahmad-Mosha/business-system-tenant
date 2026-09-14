import { Users } from 'lucide-react';
import Link from 'next/link';
import { Amount } from '@/components/amount';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { SupplierForm } from '@/components/supplier-form';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSuppliers } from '@/lib/api';
import { date, money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

export default async function SuppliersPage() {
  await requireAdmin();
  const suppliers = await getSuppliers();
  const owed = suppliers.reduce((n, s) => n + Number(s.balance), 0);
  const owing = suppliers.filter((s) => Number(s.balance) > 0).length;

  return (
    <Page fill>
      <PageHeader
        title="Suppliers"
        description="Everyone we buy stock from, and what we owe each of them."
        actions={<SupplierForm />}
      />

      <MetricGrid>
        <MetricCard label="Suppliers" value={suppliers.length} hint="Active" />
        <MetricCard
          label="Owed in total"
          value={<Amount value={owed} />}
          tone={owed > 0 ? 'warning' : 'default'}
          hint={owed > 0 ? `Across ${owing} ${owing === 1 ? 'supplier' : 'suppliers'}` : 'Nobody is owed anything'}
        />
      </MetricGrid>

      <TablePanel
        footer={
          <TableCount>
            <span className="num font-medium text-foreground">{suppliers.length}</span>{' '}
            {suppliers.length === 1 ? 'supplier' : 'suppliers'}
          </TableCount>
        }
      >
        {suppliers.length === 0 ? (
          <TableEmpty
            icon={Users}
            title="No suppliers yet"
            description="Add one to record a purchase from them."
            action={<SupplierForm />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-[160px]">Phone</TableHead>
                <TableHead className="w-[160px] text-right">Balance owed</TableHead>
                <TableHead className="w-[130px] text-right">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id} className="relative">
                  <TableCell className="max-w-0">
                    <Link
                      href={`/money/suppliers/${s.id}`}
                      className="block truncate font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      <bdi>{s.name}</bdi>
                    </Link>
                    {s.note ? (
                      <p className="truncate text-xs text-muted-foreground">
                        <bdi>{s.note}</bdi>
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="num text-muted-foreground">{s.phone ?? '—'}</TableCell>
                  <TableCell className="num text-right font-medium">
                    {Number(s.balance) > 0 ? (
                      <span className="text-warning">{money(s.balance)}</span>
                    ) : (
                      <span className="text-muted-foreground">Settled</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{date(s.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
