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
import { money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

export default async function SuppliersPage() {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('money.suppliers'), getTranslations()]);
  await requireAdmin();
  const suppliers = await getSuppliers();
  const owed = suppliers.reduce((n, s) => n + Number(s.balance), 0);
  const owing = suppliers.filter((s) => Number(s.balance) > 0).length;

  return (
    <Page fill>
      <PageHeader
        title={tr('nav.items.suppliers')}
        description={t('description')}
        actions={<SupplierForm />}
      />

      <MetricGrid>
        <MetricCard label={tr('nav.items.suppliers')} value={suppliers.length} hint={t('active')} />
        <MetricCard
          label={t('owedTotal')}
          value={<Amount value={owed} />}
          tone={owed > 0 ? 'warning' : 'default'}
          hint={
            owed > 0 ? t('across', { suppliers: tr('nouns.suppliers', { count: owing }) }) : t('nobodyOwed')
          }
        />
      </MetricGrid>

      <TablePanel
        footer={
          <TableCount>
            {tr('nouns.suppliers', { count: suppliers.length })}
          </TableCount>
        }
      >
        {suppliers.length === 0 ? (
          <TableEmpty
            icon={Users}
            title={t('empty')}
            description={t('emptyHint')}
            action={<SupplierForm />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.supplier')}</TableHead>
                <TableHead className="w-[160px]">{t('columns.phone')}</TableHead>
                <TableHead className="w-[160px] text-end">{t('columns.balance')}</TableHead>
                <TableHead className="w-[130px] text-end">{t('columns.added')}</TableHead>
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
                  <TableCell className="num text-muted-foreground">
                    <bdi>{s.phone ?? '—'}</bdi>
                  </TableCell>
                  <TableCell className="num text-end font-medium">
                    {Number(s.balance) > 0 ? (
                      <span className="text-warning">{money(s.balance)}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('settled')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground">{f.date(s.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
