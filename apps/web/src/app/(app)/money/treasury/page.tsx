import { ContextBar, Figure, Panel, Screen, Scroller } from '@/components/shell';
import { PendingCheques } from '@/components/pending-cheques';
import { TreasuryActions } from '@/components/treasury-actions';
import { getAccountLedger, getCheques, getMoneyAccounts } from '@/lib/api';
import { date, money } from '@/lib/format';
import { accountByCode, kindLabel } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

/** First day of the current month, ISO — the window "this month" totals cover. */
function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default async function TreasuryPage() {
  await requireAdmin();
  const [accounts, movements, cheques] = await Promise.all([
    getMoneyAccounts(),
    getAccountLedger('CASH', 150),
    getCheques('PENDING'),
  ]);

  const cash = accountByCode(accounts, 'CASH')?.balance ?? '0';
  const since = monthStart();
  const thisMonth = movements.filter((m) => m.occurredAt.slice(0, 10) >= since);
  const monthIn = thisMonth
    .filter((m) => Number(m.effect) > 0)
    .reduce((n, m) => n + Number(m.effect), 0);
  const monthOut = thisMonth
    .filter((m) => Number(m.effect) < 0)
    .reduce((n, m) => n + Number(m.effect), 0);

  return (
    <Screen>
      <ContextBar
        title={
          <>
            Treasury <bdi className="font-normal text-muted-foreground">الخزينة</bdi>
          </>
        }
        figures={
          <>
            <Figure label="Cash on hand" value={money(cash)} />
            <Figure label="In this month" value={money(monthIn)} tone="success" />
            <Figure
              label="Out this month"
              value={money(Math.abs(monthOut))}
              tone={monthOut < 0 ? 'destructive' : 'default'}
            />
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <TreasuryActions />
        <PendingCheques cheques={cheques} />

        <Panel>
          <Scroller>
            {movements.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted-foreground">
                No cash movements yet. Record a deposit to start.
              </p>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
                  <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">Date</th>
                    <th className="px-4 py-2.5 text-left font-medium">Description</th>
                    <th className="px-4 py-2.5 text-right font-medium">In</th>
                    <th className="px-4 py-2.5 text-right font-medium">Out</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const inflow = Number(m.effect) > 0;
                    const other = inflow ? m.creditAr : m.debitAr;
                    return (
                      <tr
                        key={m.id}
                        className="h-11 border-b border-border/60 last:border-b-0 hover:bg-accent/40"
                      >
                        <td className="px-4 whitespace-nowrap text-muted-foreground">
                          {date(m.occurredAt)}
                        </td>
                        <td className="px-4">
                          <span className="font-medium">{kindLabel(m.kind)}</span>
                          <span className="text-muted-foreground">
                            {' · '}
                            <bdi>{other}</bdi>
                            {m.memo ? ` · ${m.memo}` : ''}
                          </span>
                        </td>
                        <td className="px-4 text-right font-medium tabular-nums text-success">
                          {inflow ? money(m.amount) : ''}
                        </td>
                        <td className="px-4 text-right font-medium tabular-nums text-destructive">
                          {!inflow ? money(m.amount) : ''}
                        </td>
                        <td
                          className={cn(
                            'px-4 text-right font-medium tabular-nums',
                            Number(m.runningBalance) < 0 && 'text-destructive',
                          )}
                        >
                          {money(m.runningBalance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Scroller>
          <div className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            {movements.length >= 150
              ? 'Showing the 150 most recent movements — older ones are in the Ledger.'
              : `${movements.length} movement${movements.length === 1 ? '' : 's'}`}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
