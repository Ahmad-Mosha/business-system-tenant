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
import { isoDate } from '@/lib/format';
import { accountByCode } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getFormat } from '@/i18n/get-format';

const LIMIT = 150;

export default async function TreasuryPage() {
  const f = await getFormat();
  await requireAdmin();
  const today = new Date();
  const since = isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const [accounts, movements, cheques, month] = await Promise.all([
    getMoneyAccounts(),
    getAccountLedger('CASH', LIMIT),
    getCheques('PENDING'),
    // Totals from the API, not from the rows below — those stop at LIMIT.
    getCashFlow(since, isoDate(today), 'month'),
  ]);

  const cash = accountByCode(accounts, 'CASH')?.balance ?? '0';
  const monthIn = month.series.reduce((n, p) => n + Number(p.in), 0);
  const monthOut = -month.series.reduce((n, p) => n + Number(p.out), 0);
  const chequesTotal = cheques.reduce((n, c) => n + Number(c.amount), 0);
  const sinceLabel = `Since ${f.date(since)}`;

  return (
    <Page fill>
      <PageHeader
        title={
          <>
            Treasury <bdi className="font-sans text-lg font-normal text-muted-foreground">الخزينة</bdi>
          </>
        }
        description="Cash on hand, every movement in and out of it, and cheques waiting to clear."
        actions={<TreasuryActions />}
      />

      <MetricGrid>
        <MetricCard
          label="Cash on hand"
          value={<Amount value={cash} className={cn(Number(cash) < 0 && 'text-destructive')} />}
          hint="EGP, in the till"
          link={{ href: '/money/ledger?code=CASH', label: 'Open in the ledger' }}
        />
        <MetricCard
          label="In this month"
          value={<Amount value={monthIn} signed className={monthIn > 0 ? 'text-success' : undefined} />}
          hint={sinceLabel}
        />
        <MetricCard
          label="Out this month"
          value={<Amount value={monthOut} className={monthOut < 0 ? 'text-destructive' : undefined} />}
          hint={sinceLabel}
        />
        <MetricCard
          label="Cheques pending"
          value={<Amount value={chequesTotal} />}
          tone={cheques.length ? 'warning' : 'default'}
          hint={
            cheques.length
              ? `${cheques.length} ${cheques.length === 1 ? 'cheque' : 'cheques'} not cleared yet`
              : 'Nothing waiting to clear'
          }
        />
      </MetricGrid>

      <PendingCheques cheques={cheques} />

      <TablePanel
        minWidth="22rem"
        footer={
          <TableCount>
            {movements.length >= LIMIT
              ? `The ${LIMIT} most recent movements — older ones are in the Ledger.`
              : `${movements.length} ${movements.length === 1 ? 'movement' : 'movements'}`}
          </TableCount>
        }
      >
        {movements.length === 0 ? (
          <TableEmpty
            icon={Receipt}
            title="No cash movements yet"
            description="Record a deposit to start — every sale, payout and expense lands here after."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Movement</TableHead>
                <TableHead className="hidden w-[240px] md:table-cell">From or to</TableHead>
                <TableHead className="w-[150px] text-end">Amount</TableHead>
                <TableHead className="hidden w-[150px] text-end sm:table-cell">Balance</TableHead>
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
                            {effect > 0 ? 'from' : 'to'}
                            <AccountChip
                              name={effect > 0 ? m.creditAr : m.debitAr}
                              title={accountByCode(accounts, other)?.nameEn}
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
