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
import { money, monthStart } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

export default async function PurchasesPage() {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('money.purchases'), getTranslations()]);
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
        {t('newInvoice')}
      </Link>
    </Button>
  );

  return (
    <Page fill>
      <PageHeader
        title={tr('nav.items.purchases')}
        description={t('description')}
        actions={newInvoice}
      />

      <MetricGrid>
        <MetricCard label={t('boughtThisMonth')} value={<Amount value={monthTotal} />} hint={t('boughtHint')} />
        <MetricCard
          label={t('owed')}
          value={<Amount value={owed} />}
          tone={owed > 0.005 ? 'warning' : 'default'}
          hint={owed > 0.005 ? t('owedSome') : t('owedNone')}
          link={{ href: '/money/suppliers', label: t('openSuppliers') }}
        />
        <MetricCard
          label={t('drafts')}
          value={drafts}
          tone={drafts > 0 ? 'warning' : 'default'}
          hint={drafts > 0 ? t('draftsSome') : t('draftsNone')}
        />
      </MetricGrid>

      <TablePanel
        minWidth="52rem"
        footer={
          <TableCount>
            {tr('nouns.invoices', { count: invoices.length })}
          </TableCount>
        }
      >
        {invoices.length === 0 ? (
          <TableEmpty
            icon={ClipboardList}
            title={t('empty')}
            description={t('emptyHint')}
            action={newInvoice}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.invoice')}</TableHead>
                <TableHead>{t('columns.supplier')}</TableHead>
                <TableHead className="w-[120px]">{t('columns.date')}</TableHead>
                <TableHead className="w-[110px]">{t('columns.payment')}</TableHead>
                <TableHead className="w-[130px]">{t('columns.status')}</TableHead>
                <TableHead className="w-[140px] text-end">{t('columns.total')}</TableHead>
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
                      {i.invoiceNo ?? <span className="text-muted-foreground">{t('noRef')}</span>}
                    </Link>
                    <span className="ms-2 text-xs text-muted-foreground">
                      {tr('nouns.lines', { count: i.lineCount })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <bdi>{i.supplierName}</bdi>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.date(i.invoiceDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {tr(`enums.purchasePayment.${i.payment}`)}
                  </TableCell>
                  <TableCell>
                    <PaidChip status={i.paidStatus} />
                  </TableCell>
                  <TableCell className="num text-end font-medium">{money(i.landedTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
