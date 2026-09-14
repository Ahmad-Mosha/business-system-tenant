import { Receipt } from 'lucide-react';
import { Amount } from '@/components/amount';
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
import { getAccountLedger, getCheques, getMoneyAccounts } from '@/lib/api';
import { date, money } from '@/lib/format';
import { accountByCode, kindLabel } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

const LIMIT = 150;

/** First day of the current month, ISO — the window "this month" totals cover. */
function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default async function TreasuryPage() {
  await requireAdmin();
  const [accounts, movements, cheques] = await Promise.all([
    getMoneyAccounts(),
    getAccountLedger('CASH', LIMIT),
    getCheques('PENDING'),
  ]);

  const cash = accountByCode(accounts, 'CASH')?.balance ?? '0';
  const since = monthStart();
  const thisMonth = movements.filter((m) => m.occurredAt.slice(0, 10) >= since);
  const monthIn = thisMonth.filter((m) => Number(m.effect) > 0).reduce((n, m) => n + Number(m.effect), 0);
  const monthOut = thisMonth.filter((m) => Number(m.effect) < 0).reduce((n, m) => n + Number(m.effect), 0);
  const chequesTotal = cheques.reduce((n, c) => n + Number(c.amount), 0);
  const sinceLabel = `Since ${date(since)}`;

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
        minWidth="48rem"
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
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[130px] text-right">In</TableHead>
                <TableHead className="w-[130px] text-right">Out</TableHead>
                <TableHead className="w-[140px] text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => {
                const inflow = Number(m.effect) > 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{date(m.occurredAt)}</TableCell>
                    <TableCell className="max-w-0 truncate">
                      <span className="font-medium">{kindLabel(m.kind)}</span>
                      <span className="text-muted-foreground">
                        {' · '}
                        <bdi>{inflow ? m.creditAr : m.debitAr}</bdi>
                        {m.memo ? ` · ${m.memo}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="num text-right font-medium text-success">
                      {inflow ? money(m.amount) : ''}
                    </TableCell>
                    <TableCell className="num text-right font-medium text-destructive">
                      {!inflow ? money(m.amount) : ''}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'num text-right font-medium',
                        Number(m.runningBalance) < 0 && 'text-destructive',
                      )}
                    >
                      {money(m.runningBalance)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
