import { Archive, Contact } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Amount } from '@/components/amount';
import { CustomerForm } from '@/components/customer-form';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormat } from '@/i18n/get-format';
import { getCustomers } from '@/lib/api';
import { money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('customers'), getTranslations()]);
  await requireAdmin();
  const archived = (await searchParams).status === 'archived';
  const customers = await getCustomers(archived);
  const owed = customers.reduce((n, c) => n + Number(c.balance), 0);
  const owing = customers.filter((c) => Number(c.balance) > 0).length;

  return (
    <Page fill>
      <PageHeader
        title={archived ? t('showArchived') : t('title')}
        description={t('description')}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href={archived ? '/customers' : '/customers?status=archived'}>
                {archived ? <Contact /> : <Archive />}
                {archived ? t('showActive') : t('showArchived')}
              </Link>
            </Button>
            {archived ? null : <CustomerForm />}
          </>
        }
      />

      {archived ? null : (
        <MetricGrid>
          <MetricCard label={t('total')} value={f.count(customers.length)} hint={t('activeHint')} />
          <MetricCard
            label={t('owedTotal')}
            value={<Amount value={owed} />}
            tone={owed > 0 ? 'warning' : 'default'}
            hint={owed > 0 ? t('across', { customers: tr('nouns.customers', { count: owing }) }) : t('nobodyOwes')}
          />
        </MetricGrid>
      )}

      <TablePanel footer={<TableCount>{tr('nouns.customers', { count: customers.length })}</TableCount>}>
        {customers.length === 0 ? (
          <TableEmpty
            icon={archived ? Archive : Contact}
            title={archived ? t('archivedEmpty') : t('empty')}
            description={archived ? undefined : t('emptyHint')}
            action={archived ? undefined : <CustomerForm />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.customer')}</TableHead>
                <TableHead className="w-[160px]">{t('columns.phone')}</TableHead>
                <TableHead className="w-[160px] text-end">{t('columns.balance')}</TableHead>
                <TableHead className="w-[130px] text-end">{t('columns.added')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className="relative">
                  <TableCell className="max-w-0">
                    <Link
                      href={`/customers/${c.id}`}
                      className="block truncate font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      <bdi>{c.name}</bdi>
                    </Link>
                    {c.note ? (
                      <p className="truncate text-xs text-muted-foreground">
                        <bdi>{c.note}</bdi>
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="num text-muted-foreground">
                    <bdi>{c.phone ?? '—'}</bdi>
                  </TableCell>
                  <TableCell className="num text-end font-medium">
                    {Number(c.balance) > 0 ? (
                      <span className="text-warning">{money(c.balance)}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('settled')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground">{f.date(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
