import { Archive, ArchiveRestore, CalendarClock, FileText, HandCoins, MessageCircle, Phone, Plus, ReceiptText, Store, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { deleteCustomer, setCustomerActive } from '@/app/(app)/sales/actions';
import { Amount } from '@/components/amount';
import { ConfirmAction } from '@/components/confirm-action';
import { CustomerForm } from '@/components/customer-form';
import { SummaryMetric, SummaryStrip } from '@/components/list-page';
import { Page, PageHeader } from '@/components/page';
import { PaidChip } from '@/components/paid-chip';
import { TableEmpty, TablePanel } from '@/components/table-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormat } from '@/i18n/get-format';
import { bdi } from '@/i18n/rich';
import { getCustomer } from '@/lib/api';
import { money } from '@/lib/format';
import { whatsappHref } from '@/lib/phone';
import { blockedBy } from '@/lib/problem';
import { salesDue, salesState } from '@/lib/sales';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('customers.detail'), getTranslations()]);
  await requireAdmin();
  const { id } = await params;
  const customer = await getCustomer(id).catch(() => null);
  if (!customer) notFound();
  const owed = Number(customer.balance);
  const posted = customer.invoices.filter((i) => i.status === 'POSTED');
  const owing = posted.filter((i) => salesDue(i) > 0.005);
  const sold = posted.reduce((n, i) => n + Number(i.total), 0);
  const last = posted.map((i) => i.invoiceDate).sort().at(-1);

  return (
    <Page>
      <PageHeader
        back={{ href: '/customers', label: t('back') }}
        title={<bdi>{customer.name}</bdi>}
        description={customer.note ? <bdi>{customer.note}</bdi> : undefined}
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
            {customer.active ? (
              <Button asChild>
                <Link href={`/sales/new?customer=${customer.id}`}>
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

      <SummaryStrip label={customer.name}>
        <SummaryMetric
          label={t('owed')}
          icon={HandCoins}
          value={<Amount value={owed} />}
          hint={owed > 0 ? tr('nouns.invoices', { count: owing.length }) : tr('customers.settled')}
          attention={owed > 0}
          sensitive
        />
        <SummaryMetric label={t('sold')} icon={ReceiptText} value={<Amount value={sold} />} hint={tr('sales.postedCount', { count: posted.length })} sensitive />
        <SummaryMetric
          label={t('lastInvoice')}
          icon={CalendarClock}
          value={last ? f.date(last) : '—'}
          hint={last ? t('since', { date: f.date(customer.createdAt) }) : t('noInvoices')}
        />
      </SummaryStrip>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <TablePanel minWidth="40rem" toolbar={<h2 className="flex items-center gap-2.5 px-5 py-3.5 text-base font-semibold"><FileText className="size-4 text-muted-foreground" aria-hidden />{t('statement')}</h2>}>
          {customer.invoices.length === 0 ? (
            <TableEmpty
              icon={FileText}
              title={t('noInvoices')}
              action={customer.active ? (
                <Button asChild>
                  <Link href={`/sales/new?customer=${customer.id}`}><Plus />{t('newInvoice')}</Link>
                </Button>
              ) : undefined}
            />
          ) : (
            <Table className="[&_td]:h-16">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[22%]">{tr('sales.columns.invoice')}</TableHead>
                  <TableHead className="w-[20%]">{tr('sales.columns.status')}</TableHead>
                  <TableHead className="text-end">{tr('sales.columns.total')}</TableHead>
                  <TableHead className="text-end">{tr('sales.columns.paid')}</TableHead>
                  <TableHead className="text-end">{tr('sales.columns.remaining')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.invoices.map((i) => (
                  <TableRow key={i.id} className={cn('relative', i.status === 'VOID' && 'text-muted-foreground')}>
                    <TableCell>
                      <Link
                        href={`/sales/${i.id}`}
                        className={cn('after:absolute after:inset-0 hover:text-highlight hover:underline hover:underline-offset-4', i.invoiceNumber ? 'num font-semibold' : 'text-muted-foreground')}
                      >
                        {i.invoiceNumber ?? tr('sales.draftNumber')}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{f.date(i.invoiceDate)}</p>
                    </TableCell>
                    <TableCell><PaidChip status={salesState(i)} /></TableCell>
                    <TableCell className={cn('num text-end font-medium', i.status === 'VOID' && 'font-normal line-through')} data-sensitive>{money(i.total)}</TableCell>
                    <TableCell className="num text-end text-muted-foreground" data-sensitive>{i.status === 'POSTED' ? money(i.paidAmount) : '—'}</TableCell>
                    <TableCell className="num text-end" data-sensitive>
                      {salesDue(i) > 0.005 ? <span className="font-semibold text-warning">{money(salesDue(i))}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TablePanel>

        <aside className="max-xl:row-start-1">
          <Card className="gap-0 py-0">
            <div className="flex items-start gap-3.5 px-5 py-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary" aria-hidden>
                <Store className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('contact')}</p>
                <p className="mt-0.5 font-semibold break-words"><bdi>{customer.name}</bdi></p>
                <p className="num text-sm text-muted-foreground">{customer.phone ? <bdi>{customer.phone}</bdi> : t('noPhone')}</p>
              </div>
            </div>
            {customer.phone ? (
              <div className="grid grid-cols-2 gap-2 px-5 pb-5">
                <Button variant="outline" asChild>
                  <a href={`tel:${customer.phone}`}><Phone />{tr('orders.detail.call')}</a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={whatsappHref(customer.phone)} target="_blank" rel="noreferrer"><MessageCircle />{tr('orders.detail.whatsapp')}</a>
                </Button>
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
    </Page>
  );
}
