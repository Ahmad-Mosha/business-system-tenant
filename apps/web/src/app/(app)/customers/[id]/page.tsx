import { Archive, ArchiveRestore, FileText, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { deleteCustomer, setCustomerActive } from '@/app/(app)/sales/actions';
import { Amount } from '@/components/amount';
import { ConfirmAction } from '@/components/confirm-action';
import { CustomerForm } from '@/components/customer-form';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { TableEmpty, TablePanel } from '@/components/table-panel';
import { ToneBadge } from '@/components/tone-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormat } from '@/i18n/get-format';
import { bdi } from '@/i18n/rich';
import { getCustomer } from '@/lib/api';
import { money } from '@/lib/format';
import { SALES_TONE, salesPaidStatus } from '@/lib/sales';
import { blockedBy } from '@/lib/problem';
import { requireAdmin } from '@/lib/session';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('customers.detail'), getTranslations()]);
  await requireAdmin();
  const { id } = await params;
  const customer = await getCustomer(id).catch(() => null);
  if (!customer) notFound();
  const owed = Number(customer.balance);
  const posted = customer.invoices.filter((i) => i.status === 'POSTED');
  const sold = posted.reduce((n, i) => n + Number(i.total), 0);

  return (
    <Page>
      <PageHeader
        back={{ href: '/customers', label: t('back') }}
        title={<bdi>{customer.name}</bdi>}
        description={customer.phone || customer.note ? <bdi>{[customer.phone, customer.note].filter(Boolean).join(' · ')}</bdi> : t('fallback')}
        actions={
          <>
            <CustomerForm customer={customer} />
            {customer.active ? (
              <ConfirmAction
                trigger={
                  <Button variant="outline">
                    <Archive />
                    {t('archive')}
                  </Button>
                }
                title={t.rich('archiveTitle', { name: customer.name, bdi })}
                description={t('archiveDescription')}
                confirmLabel={t('archiveConfirm')}
                success={t('archived')}
                action={setCustomerActive.bind(null, customer.id, false)}
                blocked={blockedBy('customer.archiveBlocked', customer.blocked?.archive)}
                blockedTitle={<bdi>{customer.name}</bdi>}
              />
            ) : (
              <ConfirmAction
                trigger={
                  <Button variant="outline">
                    <ArchiveRestore />
                    {t('restore')}
                  </Button>
                }
                title={t('restore')}
                description={t('archivedBanner')}
                confirmLabel={t('restore')}
                success={t('restored')}
                action={setCustomerActive.bind(null, customer.id, true)}
              />
            )}
            {(
              <ConfirmAction
                trigger={
                  <Button variant="outline" className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
                    <Trash2 />
                    {t('delete')}
                  </Button>
                }
                title={t.rich('deleteTitle', { name: customer.name, bdi })}
                description={t('deleteDescription')}
                confirmLabel={t('deleteConfirm')}
                destructive
                action={deleteCustomer.bind(null, customer.id)}
                blocked={blockedBy('customer.deleteBlocked', customer.blocked?.delete)}
                blockedTitle={<bdi>{customer.name}</bdi>}
              />
            )}
            {customer.active ? (
              <Button asChild>
                <Link href="/sales/new">
                  <Plus />
                  {t('newInvoice')}
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {!customer.active ? (
        <Alert>
          <Archive />
          <AlertDescription>{t('archivedBanner')}</AlertDescription>
        </Alert>
      ) : null}

      <MetricGrid>
        <MetricCard label={t('owed')} value={<Amount value={owed} />} tone={owed > 0 ? 'warning' : 'default'} hint={owed > 0 ? undefined : tr('customers.settled')} />
        <MetricCard label={tr('sales.invoices')} value={<Amount value={sold} />} hint={tr('sales.postedCount', { count: posted.length })} />
      </MetricGrid>

      <TablePanel minWidth="48rem">
        {customer.invoices.length === 0 ? (
          <TableEmpty icon={FileText} title={t('noInvoices')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">{tr('sales.columns.invoice')}</TableHead>
                <TableHead>{tr('sales.columns.date')}</TableHead>
                <TableHead className="w-[110px]">{tr('sales.columns.status')}</TableHead>
                <TableHead className="w-[140px] text-end">{tr('sales.columns.total')}</TableHead>
                <TableHead className="w-[130px]">{tr('sales.columns.payment')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.invoices.map((i) => (
                <TableRow key={i.id} className="relative">
                  <TableCell>
                    <Link href={`/sales/${i.id}`} className="num after:absolute after:inset-0 hover:underline">
                      {i.invoiceNumber ?? tr('sales.draftNumber')}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.date(i.invoiceDate)}</TableCell>
                  <TableCell>
                    <ToneBadge tone={SALES_TONE[i.status]}>{tr(`enums.salesStatus.${i.status}`)}</ToneBadge>
                  </TableCell>
                  <TableCell className="num text-end font-medium">{money(i.total)}</TableCell>
                  <TableCell>{salesPaidStatus(i) ? <PaidChip status={salesPaidStatus(i)!} /> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
