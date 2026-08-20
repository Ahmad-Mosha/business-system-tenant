import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { NoDataYet } from '@/components/empty-state';
import { OpeningBalanceForm } from '@/components/opening-balance-form';
import { PageBody, PageHeader, SectionHeading } from '@/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAccount, getPeriods } from '@/lib/api';
import { money, monthLabel } from '@/lib/format';

export default async function MonthsPage() {
  const [periods, account] = await Promise.all([getPeriods(), getAccount()]);

  if (!periods.length) {
    return (
      <>
        <PageHeader title="Months" description="Each settlement period on its own" />
        <PageBody>
          <NoDataYet />
        </PageBody>
      </>
    );
  }

  const anchored = account.openingAsOf !== null;

  return (
    <>
      <PageHeader
        title="Months"
        description="Each month on its own, and the balance carried between them"
      />

      <PageBody>
        <section>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[130px]">Month</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Proceeds</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="text-right">Cash to bank</TableHead>
                  <TableHead className="text-right">Movement</TableHead>
                  <TableHead className="text-right">Owed by noon</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.month} className="group">
                    <TableCell className="font-medium">
                      <Link
                        href={`/months/${p.month}`}
                        className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                      >
                        {monthLabel(p.month)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.unitsSold}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(p.netProceeds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {money(p.fees)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {money(p.payouts)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(p.movement)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {p.closingBalance === null ? (
                        <span className="text-muted-foreground/40">—</span>
                      ) : (
                        money(p.closingBalance)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChevronRight className="size-4 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Movement</span> is what the
            month added to your noon balance.{' '}
            <span className="font-medium text-foreground">Cash to bank</span> is what
            noon actually transferred.{' '}
            <span className="font-medium text-foreground">Owed by noon</span> is what
            was still unpaid at month end.
          </p>
        </section>

        <section className="max-w-xl">
          <SectionHeading
            title="Opening balance"
            hint={anchored ? 'anchored' : 'not set'}
          />
          <div className="rounded-xl border border-border p-5">
            <p className="mb-4 text-sm text-muted-foreground">
              An export only covers the months you downloaded, so the balance it
              describes is relative. Enter the balance noon showed{' '}
              <span className="text-foreground">before</span> your earliest import and
              every later balance follows from it.
            </p>
            <OpeningBalanceForm
              openingBalance={account.openingBalance}
              openingAsOf={account.openingAsOf}
            />
          </div>
        </section>
      </PageBody>
    </>
  );
}
