import { FileText, Plus } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Amount } from '@/components/amount';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { ToneBadge } from '@/components/tone-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFormat } from '@/i18n/get-format';
import { getSalesInvoices } from '@/lib/api';
import { money } from '@/lib/format';
import { SALES_TONE } from '@/lib/sales';
import { requireAdmin } from '@/lib/session';

export default async function SalesInvoicesPage() {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('sales'), getTranslations()]);
  await requireAdmin();
  const invoices = await getSalesInvoices();
  const drafts = invoices.filter((i) => i.status === 'DRAFT');
  const draftValue = drafts.reduce((n, i) => n + Number(i.total), 0);

  const newInvoice = (
    <Button asChild>
      <Link href="/sales/new">
        <Plus />
        {t('new')}
      </Link>
    </Button>
  );

  return (
    <Page fill>
      <PageHeader title={t('title')} description={t('description')} actions={newInvoice} />

      <MetricGrid>
        <MetricCard label={t('invoices')} value={f.count(invoices.length)} hint={t('postedCount', { count: invoices.filter((i) => i.status === 'POSTED').length })} />
        <MetricCard label={t('drafts')} value={f.count(drafts.length)} hint={t('draftsHint')} />
        <MetricCard label={t('draftValue')} value={<Amount value={draftValue} />} hint={t('draftValueHint')} />
      </MetricGrid>

      <TablePanel minWidth="52rem" footer={<TableCount>{tr('nouns.invoices', { count: invoices.length })}</TableCount>}>
        {invoices.length === 0 ? (
          <TableEmpty icon={FileText} title={t('empty')} description={t('emptyHint')} action={newInvoice} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">{t('columns.invoice')}</TableHead>
                <TableHead>{t('columns.customer')}</TableHead>
                <TableHead className="w-[130px]">{t('columns.date')}</TableHead>
                <TableHead className="w-[110px]">{t('columns.status')}</TableHead>
                <TableHead className="w-[90px] text-end">{t('columns.lines')}</TableHead>
                <TableHead className="w-[140px] text-end">{t('columns.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => (
                <TableRow key={i.id} className="relative">
                  <TableCell>
                    <Link
                      href={`/sales/${i.id}`}
                      className={i.invoiceNumber ? 'num font-medium after:absolute after:inset-0 hover:underline' : 'text-muted-foreground after:absolute after:inset-0 hover:underline'}
                    >
                      {i.invoiceNumber ?? t('draftNumber')}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-0 truncate font-medium">
                    <bdi>{i.customerName}</bdi>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.date(i.invoiceDate)}</TableCell>
                  <TableCell>
                    <ToneBadge tone={SALES_TONE[i.status]}>{tr(`enums.salesStatus.${i.status}`)}</ToneBadge>
                  </TableCell>
                  <TableCell className="num text-end text-muted-foreground">{f.count(i.lineCount)}</TableCell>
                  <TableCell className="num text-end font-medium">{money(i.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
