import { ArrowRight, BookText } from 'lucide-react';
import Link from 'next/link';
import { FilterBar } from '@/components/filter-bar';
import { Page, PageHeader } from '@/components/page';
import { TableEmpty, TablePagination, TablePanel } from '@/components/table-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getLedger, getMoneyAccounts } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { kindLabel } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

const PAGE_SIZE = 30;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const code = params.code;
  const from = params.from && ISO.test(params.from) ? params.from : undefined;
  const to = params.to && ISO.test(params.to) ? params.to : undefined;
  const page = Math.max(Number(params.page) || 1, 1);

  const keep = new URLSearchParams();
  if (code) keep.set('code', code);
  if (from) keep.set('from', from);
  if (to) keep.set('to', to);

  const query = new URLSearchParams(keep);
  query.set('limit', String(PAGE_SIZE));
  query.set('offset', String((page - 1) * PAGE_SIZE));

  const [accounts, { entries, total }] = await Promise.all([
    getMoneyAccounts(),
    getLedger(query.toString()),
  ]);
  const account = accounts.find((a) => a.code === code);

  const pageHref = (p: number) => {
    const next = new URLSearchParams(keep);
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return qs ? `/money/ledger?${qs}` : '/money/ledger';
  };

  return (
    <Page fill>
      <PageHeader
        title="Ledger"
        description={
          account ? (
            <>
              Every movement through <span className="text-foreground">{account.nameEn}</span>{' '}
              <bdi>({account.nameAr})</bdi>.
            </>
          ) : (
            'Every recorded movement of value, oldest to newest at the bottom.'
          )
        }
      />

      <FilterBar
        filters={[
          {
            kind: 'select',
            param: 'code',
            all: 'All accounts',
            options: accounts.map((a) => ({ value: a.code, label: a.nameEn, hint: a.nameAr })),
          },
          { kind: 'dates', from: 'from', to: 'to' },
        ]}
      />

      <TablePanel
        minWidth="48rem"
        footer={
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            count={entries.length}
            noun="entries"
            href={pageHref}
          />
        }
      >
        {entries.length === 0 ? (
          <TableEmpty
            icon={BookText}
            title="Nothing recorded for this view"
            description={keep.size ? 'Try another account or date range.' : 'Entries appear as money moves.'}
            action={
              keep.size ? (
                <Button variant="outline" asChild>
                  <Link href="/money/ledger">Reset filters</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">When</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>From → to</TableHead>
                <TableHead className="w-[140px] text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">{dateTime(e.occurredAt)}</TableCell>
                  <TableCell className="max-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-medium">{kindLabel(e.kind)}</span>
                      {e.reversesId ? <Badge variant="outline">Reversal</Badge> : null}
                      {e.memo ? <span className="truncate text-muted-foreground">{e.memo}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <bdi>{e.creditAr}</bdi>
                      <ArrowRight className="size-3.5 shrink-0 opacity-60" />
                      <bdi>{e.debitAr}</bdi>
                    </span>
                  </TableCell>
                  <TableCell className="num text-right font-medium">{money(e.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
