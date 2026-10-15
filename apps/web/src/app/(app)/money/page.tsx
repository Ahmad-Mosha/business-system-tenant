import { ArrowDownRight, ArrowUpRight, Boxes, ChevronDown, ChevronLeft, FileClock, FileText, HandCoins, Landmark, Minus, PackagePlus, Receipt, Store, Truck, Undo2, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Amount } from '@/components/amount';
import { BarList, CashFlowChart, OUT_FILL, type BarItem, type Bucket } from '@/components/charts';
import { SummaryMetric, SummaryStrip } from '@/components/list-page';
import { MoneyAnchorForm } from '@/components/money-anchor-form';
import { Page, PageHeader } from '@/components/page';
import { PeriodTabs } from '@/components/period-tabs';
import { ProfitSection } from '@/components/profit-breakdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  getCashFlow,
  getBusinessProfit,
  getFinanceOverview,
  getMoneyAccounts,
  getOrderSummary,
  getPurchases,
  getSalesInvoices,
  type CashFlow,
} from '@/lib/api';
import { daysAgo, money, today } from '@/lib/format';
import { accountByCode, accountName, CASH_IN, CASH_OUT, groupAccounts, purchaseDue } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn, isOneOf } from '@/lib/utils';
import { getLocale, getTranslations } from 'next-intl/server';

/** The windows the overview can cover, and how finely each one is bucketed. */
const RANGES = [
  { value: '7d', days: 7, bucket: 'day' },
  // A month reads best as weeks — thirty thin daily bars were mostly empty.
  { value: '30d', days: 30, bucket: 'week' },
  { value: '90d', days: 90, bucket: 'week' },
  { value: '12m', days: 365, bucket: 'month' },
] as const satisfies ReadonlyArray<{ value: string; days: number; bucket: Bucket }>;

const DEFAULT_RANGE = '30d';

const sum = (series: CashFlow['series'], key: 'in' | 'out') =>
  series.reduce((n, p) => n + Number(p[key]), 0);

/** Change against the window before, in percent — only when there was something to compare with. */
const change = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);

export default async function MoneyOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, tr, locale] = await Promise.all([
    getTranslations('money'),
    getTranslations(),
    getLocale(),
  ]);
  await requireAdmin();
  const overview = await getFinanceOverview();

  if (overview.openingAsOf === null) {
    return (
      <Page width="narrow">
        <PageHeader title={t('title')} description={t('start.description')} />
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>{t('start.title')}</EmptyTitle>
            <EmptyDescription>{t('start.hint')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-md">
            <MoneyAnchorForm openingBalance={overview.openingBalance} openingAsOf={overview.openingAsOf} />
          </EmptyContent>
        </Empty>
      </Page>
    );
  }

  const params = await searchParams;
  const range = RANGES.find((r) => r.value === params.range) ?? RANGES.find((r) => r.value === DEFAULT_RANGE)!;
  const to = today();
  const from = daysAgo(range.days - 1);
  // The same length of time just before, for "vs the previous 30 days".
  const before = { from: daysAgo(range.days * 2 - 1), to: daysAgo(range.days) };

  const [accounts, flow, previous, businessProfit, orders, sales, purchases] = await Promise.all([
    getMoneyAccounts(),
    getCashFlow(from, to, range.bucket),
    getCashFlow(before.from, before.to, 'month'),
    getBusinessProfit(from, to, range.bucket),
    getOrderSummary(),
    getSalesInvoices(),
    getPurchases(),
  ]);

  const balance = (code: string) => Number(accountByCode(accounts, code)?.balance ?? 0);
  const cash = balance('CASH');
  const rangeLabel = t(`ranges.${range.value}`);
  const last = t('lastRange', { range: rangeLabel });
  const moneyIn = sum(flow.series, 'in');
  const moneyOut = sum(flow.series, 'out');
  const net = moneyIn - moneyOut;
  // A window that starts before the books did holds only part of its days —
  // "+8,700% vs the 90 days before" would be comparing against nothing.
  const comparable = before.from >= overview.openingAsOf;
  const inChange = comparable ? change(moneyIn, sum(previous.series, 'in')) : null;
  const outChange = comparable ? change(moneyOut, sum(previous.series, 'out')) : null;
  const ledgerFor = (code: string) => `/money/ledger?code=${code}&from=${from}&to=${to}`;

  // Who owes the business, and whom it owes — every line opens the records behind it.
  const salesDue = sales.filter((i) => i.status === 'POSTED' && Number(i.total) - Number(i.paidAmount) > 0.005).length;
  const purchasesDue = purchases.filter((i) => purchaseDue(i) > 0.005).length;
  const owedToYou: Row[] = [
    { key: 'noon', icon: Store, label: t('home.noon'), detail: t('home.noonDetail'), amount: balance('NOON_RECEIVABLE'), href: '/' },
    { key: 'customers', icon: FileText, label: t('home.customers'), detail: t('home.customersDetail', { count: salesDue }), amount: balance('CUSTOMER_RECEIVABLE'), href: '/sales?view=due' },
    {
      key: 'cod',
      icon: Truck,
      label: t('home.cod'),
      detail: t('home.codDetail', { count: orders.deliveredUnpaid }),
      amount: Number(orders.deliveredUnpaidAmount),
      href: '/orders?status=DELIVERED&paymentStatus=UNPAID',
    },
    { key: 'bosta', icon: Truck, label: t('home.bosta'), detail: t('home.bostaDetail'), amount: balance('BOSTA_COD'), href: '/shipments' },
    { key: 'cheques', icon: FileClock, label: t('home.cheques'), detail: t('home.chequesDetail'), amount: balance('CHEQUES_PENDING'), href: '/money/treasury' },
    { key: 'amazon', icon: Store, label: t('home.amazon'), detail: t('home.amazonDetail'), amount: balance('AMAZON_RECEIVABLE'), href: '/money/ledger?code=AMAZON_RECEIVABLE' },
  ].filter((r) => Math.abs(r.amount) > 0.005);
  const youOwe: Row[] = [
    { key: 'suppliers', icon: PackagePlus, label: t('home.suppliers'), detail: t('home.suppliersDetail', { count: purchasesDue }), amount: balance('SUPPLIER_PAYABLE'), href: '/money/purchases?view=due' },
    { key: 'refunds', icon: Undo2, label: t('home.refunds'), detail: t('home.refundsDetail'), amount: balance('CUSTOMER_REFUNDS'), href: '/orders?paymentStatus=REFUND_DUE' },
  ].filter((r) => Math.abs(r.amount) > 0.005);
  const totalOf = (rows: Row[]) => rows.reduce((n, r) => n + r.amount, 0);

  const sources = (direction: 'in' | 'out'): BarItem[] =>
    flow.sources
      .filter((s) => s.direction === direction)
      .map((s) => ({
        key: s.code,
        label:
          direction === 'in'
            ? isOneOf(CASH_IN, s.code)
              ? tr(`enums.cashIn.${s.code}`)
              : accountName(s, locale)
            : isOneOf(CASH_OUT, s.code)
              ? tr(`enums.cashOut.${s.code}`)
              : accountName(s, locale),
        value: Number(s.amount),
        fill: direction === 'in' ? 'var(--primary)' : OUT_FILL,
        href: ledgerFor(s.code),
      }));

  const groups = groupAccounts(accounts);
  const held = groups.held.map((a) => ({ key: a.code, label: accountName(a, locale), balance: a.balance, href: `/money/ledger?code=${a.code}` }));
  held.push({ key: 'STOCK', label: tr('inventory.stockValue'), balance: overview.stockValue, href: '/inventory' });
  const rows = (list: typeof groups.owe) =>
    list.map((a) => ({ key: a.code, label: accountName(a, locale), balance: a.balance, href: `/money/ledger?code=${a.code}` }));
  const compared = (range: string) => t('vsBefore', { range });

  return (
    <Page>
      <PageHeader title={t('title')} description={t('home.description')} />


      {/* 1. Right now — where the money is today, whatever the period below. */}
      <section className="grid gap-5">
      <div>
        <h2 className="text-lg font-semibold">{t('home.now')}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{t('home.nowHint')}</p>
      </div>
      <SummaryStrip label={t('home.now')}>
        <SummaryMetric
          label={tr('charts.cashOnHand')}
          icon={Landmark}
          value={<Amount value={cash} className={cn(cash < 0 && 'text-destructive')} />}
          hint={t('home.cashHint')}
          href="/money/treasury"
          sensitive
        />
        <SummaryMetric
          label={t('home.owedToYou')}
          icon={HandCoins}
          value={<Amount value={totalOf(owedToYou)} />}
          hint={owedToYou.length ? t('home.owedToYouHint', { count: owedToYou.length }) : t('home.owedNone')}
          sensitive
        />
        <SummaryMetric
          label={t('home.youOwe')}
          icon={Receipt}
          value={<Amount value={totalOf(youOwe)} />}
          hint={youOwe.length ? t('home.youOweHint') : t('home.oweNone')}
          href={purchasesDue ? '/money/purchases?view=due' : undefined}
          attention={totalOf(youOwe) > 0.005}
          hintAttention={false}
          sensitive
        />
        <SummaryMetric
          label={t('home.stock')}
          icon={Boxes}
          value={<Amount value={overview.stockValue} />}
          hint={t('overview.stockHint')}
          href="/inventory"
          sensitive
        />
      </SummaryStrip>

      {/* 2. Who owes whom, line by line. */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Balances title={t('home.owedToYou')} total={totalOf(owedToYou)} rows={owedToYou} empty={t('home.owedNone')} />
        <Balances title={t('home.youOwe')} total={totalOf(youOwe)} rows={youOwe} empty={t('home.oweNone')} owing />
      </div>
      </section>

      {/* 3. Over a period — the tabs live here, with what they change. */}
      <section className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t('home.periodTitle', { range: rangeLabel })}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{t('home.periodHint')}</p>
          </div>
          <PeriodTabs
            value={range.value}
            options={RANGES.map((r) => ({ value: r.value, label: t(`ranges.${r.value}`) }))}
            href={(v) => (v === DEFAULT_RANGE ? '/money' : `/money?range=${v}`)}
          />
        </div>

        <Card className="gap-0 py-0" data-sensitive-scope>
          <div className="grid border-b sm:grid-cols-3 [&>*+*]:border-t sm:[&>*+*]:border-t-0 sm:[&>*+*]:border-s">
            <FlowStat label={tr('charts.moneyIn')} value={<Amount value={moneyIn} className="text-success" />}>
              {inChange !== null ? <Change value={inChange} note={compared(rangeLabel)} /> : t('inLast', { range: rangeLabel })}
            </FlowStat>
            <FlowStat label={tr('charts.moneyOut')} value={<Amount value={moneyOut} />}>
              {outChange !== null ? <Change value={outChange} invert note={compared(rangeLabel)} /> : t('inLast', { range: rangeLabel })}
            </FlowStat>
            <FlowStat label={t('overview.netFlow')} value={<Amount value={net} signed className={cn(net < 0 && 'text-destructive')} />}>
              {net >= 0 ? t('overview.netPositive') : t('overview.netNegative')}
            </FlowStat>
          </div>
          <div className="px-5 pt-5 pb-3">
            <CashFlowChart series={flow.series} bucket={range.bucket} />
          </div>
          <div className="grid gap-6 border-t px-5 py-5 lg:grid-cols-2 lg:gap-10">
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t('overview.cameFrom')}</h3>
              <BarList items={sources('in')} empty={t('overview.nothingIn')} />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t('overview.wentTo')}</h3>
              <BarList items={sources('out')} empty={t('overview.nothingOut')} />
            </div>
          </div>
        </Card>

        <Card data-sensitive-scope>
          <CardHeader>
            <CardTitle>{t('overview.profitTitle')}</CardTitle>
            <CardDescription>{t('overview.profitHint', { span: last })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfitSection report={businessProfit} bucket={range.bucket} />
          </CardContent>
        </Card>
      </section>

      {/* 4. For the accountant: every account's balance, folded away. */}
      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-sm font-semibold">{t('overview.books')}</span>
            <span className="block text-xs text-muted-foreground">{t('overview.booksHint')}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-x-8 gap-y-5 border-t px-5 py-5 md:grid-cols-2 xl:grid-cols-4" data-sensitive-scope>
          <AccountList title={t('overview.held')} rows={held} />
          <AccountList title={t('overview.owe')} rows={rows(groups.owe)} />
          <AccountList title={t('overview.capital')} rows={rows(groups.capital)} />
          <AccountList title={t('overview.performance')} rows={rows(groups.performance)} muted />
        </div>
      </details>
    </Page>
  );
}

interface Row {
  key: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  amount: number;
  href: string;
}

/** One side of the books in plain words: its total, then each line, each opening its records. */
function Balances({ title, total, rows, empty, owing = false }: { title: string; total: number; rows: Row[]; empty: string; owing?: boolean }) {
  return (
    <Card className="gap-0 py-0" data-sensitive-scope>
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <Amount value={total} className={cn('text-xl font-semibold tracking-tight', owing && total > 0.005 && 'text-warning')} />
      </div>
      {rows.length ? (
        <ul className="divide-y border-t">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-muted/40">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground">
                  <r.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium group-hover:text-highlight">{r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                </span>
                <span className="num shrink-0 font-semibold">{money(r.amount)}</span>
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t px-5 py-6 text-sm text-muted-foreground">{empty}</p>
      )}
    </Card>
  );
}

/** One of the figures under the balance: what it is, how much, and against what. */
function FlowStat({ label, value, children }: { label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-(--card-spacing) py-4 [--card-spacing:--spacing(4)]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-xl font-semibold tracking-[-0.02em]">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * A change against the period before, as words with a small arrow — not a
 * coloured pill. `invert` is for figures where less is better (money out).
 */
function Change({ value, invert = false, note }: { value: number; invert?: boolean; note: string }) {
  const flat = Math.abs(value) < 0.05;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const good = invert ? value < 0 : value > 0;
  return (
    <>
      <span className={cn('inline-flex items-center gap-0.5 font-medium', !flat && (good ? 'text-success' : 'text-destructive'))}>
        <Icon className="size-3.5" />
        <bdi className="num">{`${Math.abs(value).toFixed(1)}%`}</bdi>
      </span>{' '}
      {note}
    </>
  );
}

function AccountList({
  title,
  rows,
  muted,
}: {
  title: string;
  rows: Array<{ key: string; label: string; balance: string; href: string }>;
  muted?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 border-b pb-2 font-sans text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="grid">
        {rows.map((a) => (
          <li key={a.key}>
            <Link
              href={a.href}
              className="-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted/60"
            >
              <span className={cn('truncate', muted && 'text-muted-foreground')}>{a.label}</span>
              <span className={cn('num shrink-0', muted ? 'text-muted-foreground' : 'font-medium')}>{money(a.balance)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
