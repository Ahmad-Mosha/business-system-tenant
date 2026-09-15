import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { NoDataYet } from '@/components/empty-state';
import { OpeningBalanceForm } from '@/components/opening-balance-form';
import { Page, PageHeader } from '@/components/page';
import { ToneBadge } from '@/components/tone-badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAccount, getPeriods } from '@/lib/api';
import { money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { strong } from '@/i18n/rich';
import { getFormat } from '@/i18n/get-format';

export default async function MonthsPage() {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('noon'), getTranslations()]);
  await requireAdmin();
  const [periods, account] = await Promise.all([getPeriods(), getAccount()]);

  if (!periods.length) {
    return (
      <Page>
        <PageHeader title={tr('nav.items.months')} description={t('months.noDataDescription')} />
        <NoDataYet />
      </Page>
    );
  }

  const anchored = account.openingAsOf !== null;

  return (
    <Page>
      <PageHeader title={tr('nav.items.months')} description={t('months.description')} />

      <Card className="pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('months.month')}</TableHead>
              <TableHead className="text-end">{t('statement.units')}</TableHead>
              <TableHead className="text-end">{t('months.proceeds')}</TableHead>
              <TableHead className="text-end">{t('statement.fees')}</TableHead>
              <TableHead className="text-end">{t('statement.cashToBank')}</TableHead>
              <TableHead className="text-end">{t('months.movement')}</TableHead>
              <TableHead className="text-end">{t('statement.owedByNoon')}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((p) => (
              <TableRow key={p.month} className="group relative">
                <TableCell className="font-medium">
                  <Link
                    href={`/months/${p.month}`}
                    className="after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {f.month(p.month)}
                  </Link>
                </TableCell>
                <TableCell className="num text-end">{p.unitsSold}</TableCell>
                <TableCell className="num text-end">{money(p.netProceeds)}</TableCell>
                <TableCell className="num text-end text-muted-foreground">{money(p.fees)}</TableCell>
                <TableCell className="num text-end text-muted-foreground">{money(p.payouts)}</TableCell>
                <TableCell className="num text-end font-medium">{money(p.movement)}</TableCell>
                <TableCell className="num text-end font-medium">
                  {p.closingBalance === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    money(p.closingBalance)
                  )}
                </TableCell>
                <TableCell className="text-end">
                  <ChevronRight className="inline size-4 rtl:rotate-180 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="border-t px-4 py-3 text-xs/relaxed text-muted-foreground">
          {t.rich('months.legend', { strong })}
        </p>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('months.opening')}</CardTitle>
          <CardDescription>{t.rich('months.openingHint', { strong })}</CardDescription>
          <CardAction>
            <ToneBadge tone={anchored ? 'success' : 'warning'}>
              {anchored ? t('months.set') : tr('common.notSet')}
            </ToneBadge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <OpeningBalanceForm openingBalance={account.openingBalance} openingAsOf={account.openingAsOf} />
        </CardContent>
      </Card>
    </Page>
  );
}
