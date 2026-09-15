import { Receipt } from 'lucide-react';
import { Fragment } from 'react';
import { Amount } from '@/components/amount';
import { AccountChip, DayRow, directionOf, EntryCell, MONEY } from '@/components/ledger-entry';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { PendingCheques } from '@/components/pending-cheques';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { TreasuryActions } from '@/components/treasury-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAccountLedger, getCashFlow, getCheques, getMoneyAccounts } from '@/lib/api';
import { monthStart, today } from '@/lib/format';
import { accountByCode, accountName } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getLocale, getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

const LIMIT = 150;

export default async function TreasuryPage() {
  const [f, t, tr, locale] = await Promise.all([
    getFormat(),
    getTranslations('money.treasury'),
    getTranslations(),
    getLocale(),
  ]);
  await requireAdmin();
  const since = monthStart();
  const [accounts, movements, cheques, month] = await Promise.all([
    getMoneyAccounts(),
    getAccountLedger('CASH', LIMIT),
    getCheques('PENDING'),
    // Totals from the API, not from the rows below — those stop at LIMIT.
    getCashFlow(since, today(), 'month'),
  ]);

  const cash = accountByCode(accounts, 'CASH')?.balance ?? '0';
  const monthIn = month.series.reduce((n, p) => n + Number(p.in), 0);
  const monthOut = -month.series.reduce((n, p) => n + Number(p.out), 0);
  const chequesTotal = cheques.reduce((n, c) => n + Number(c.amount), 0);
  const sinceLabel = t('since', { date: f.date(since) });
  const nameOf = (code: string, fallback: string) => {
    const a = accountByCode(accounts, code);
    return a ? accountName(a, locale) : fallback;
  };

  return (
    <Page fill>
      <PageHeader
        title={tr('nav.items.treasury')}
        description={t('description')}
        actions={<TreasuryActions />}
      />

      <MetricGrid>
        <MetricCard
          label={tr('charts.cashOnHand')}
          value={<Amount value={cash} className={cn(Number(cash) < 0 && 'text-destructive')} />}
          hint={t('cashHint')}
          link={{ href: '/money/ledger?code=CASH', label: t('openInLedger') }}
        />
        <MetricCard
          label={t('inThisMonth')}
          value={<Amount value={monthIn} signed className={monthIn > 0 ? 'text-success' : undefined} />}
          hint={sinceLabel}
        />
        <MetricCard
          label={t('outThisMonth')}
          value={<Amount value={monthOut} className={monthOut < 0 ? 'text-destructive' : undefined} />}
          hint={sinceLabel}
        />
        <MetricCard
          label={t('chequesPending')}
          value={<Amount value={chequesTotal} />}
          tone={cheques.length ? 'warning' : 'default'}
          hint={cheques.length ? t('chequesNotCleared', { count: cheques.length }) : t('nothingPending')}
        />
      </MetricGrid>

      <PendingCheques cheques={cheques} />

      <TablePanel
        minWidth="22rem"
        footer={
          <TableCount>
            {movements.length >= LIMIT
              ? t('recent', { limit: LIMIT })
              : tr('nouns.movements', { count: movements.length })}
          </TableCount>
        }
      >
        {movements.length === 0 ? (
          <TableEmpty
            icon={Receipt}
            title={t('empty')}
            description={t('emptyHint')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.movement')}</TableHead>
                <TableHead className="hidden w-[240px] md:table-cell">{t('columns.fromOrTo')}</TableHead>
                <TableHead className="w-[150px] text-end">{t('columns.amount')}</TableHead>
                <TableHead className="hidden w-[150px] text-end sm:table-cell">{t('columns.balance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.byDay(movements).map((day) => (
                <Fragment key={day.key}>
                  <DayRow label={day.label} span={4} />
                  {day.rows.map((m) => {
                    const effect = Number(m.effect);
                    const mark = MONEY[directionOf(effect)];
                    // The treasury is one end of every row here; the other end is the story.
                    const other = effect > 0 ? m.creditCode : m.debitCode;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="h-14 max-w-0">
                          <EntryCell entry={m} mark={mark} when={f.time(m.occurredAt)} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                            {effect > 0 ? t('from') : t('to')}
                            <AccountChip
                              name={nameOf(other, effect > 0 ? m.creditAr : m.debitAr)}
                              title={nameOf(other, '')}
                              href={`/money/ledger?code=${other}`}
                            />
                          </span>
                        </TableCell>
                        <TableCell className="text-end">
                          <Amount value={effect} signed className={cn('text-sm font-semibold', mark.tone)} />
                        </TableCell>
                        <TableCell className="hidden text-end sm:table-cell">
                          <Amount
                            value={m.runningBalance}
                            className={cn('font-medium', Number(m.runningBalance) < 0 && 'text-destructive')}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
