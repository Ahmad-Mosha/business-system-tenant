import { ArrowDownRight, ArrowUpRight, ChevronLeft, Minus, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Amount } from '@/components/amount';
import { ProfitTrendChart, type Bucket } from '@/components/charts';
import { MoneyAnchorForm } from '@/components/money-anchor-form';
import { Page, PageHeader } from '@/components/page';
import { PeriodTabs } from '@/components/period-tabs';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  getFinanceOverview,
  getMoneyAccounts,
  getOrderSummary,
  getPerformance,
  type PerformanceReport,
} from '@/lib/api';
import { daysAgo, money, today } from '@/lib/format';
import { accountByCode } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

/** The windows the overview can cover, and how finely its chart is bucketed. */
const RANGES = [
  { value: '7d', days: 7, bucket: 'day' },
  { value: '30d', days: 30, bucket: 'day' },
  { value: '90d', days: 90, bucket: 'week' },
  { value: '12m', days: 365, bucket: 'month' },
] as const satisfies ReadonlyArray<{ value: string; days: number; bucket: Bucket }>;

const DEFAULT_RANGE = '30d';

/** Change against the window before, in percent — only when there was something to compare with. */
const change = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);

/**
 * The owners' money screen, answering one question first: is the business
 * making money? Net profit for the period, large, with its chart; then how
 * sales became that profit, and which channels it came from; then, in a line,
 * who owes whom. Everything else — the treasury's movements, the expenses, the
 * books — is one click away rather than another box here.
 */
export default async function MoneyOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, tr] = await Promise.all([getTranslations('money'), getTranslations()]);
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
  const before = { from: daysAgo(range.days * 2 - 1), to: daysAgo(range.days) };

  const [accounts, pnl, pnlBefore, orders] = await Promise.all([
    getMoneyAccounts(),
    getPerformance(from, to, range.bucket),
    getPerformance(before.from, before.to),
    getOrderSummary(),
  ]);

  const balance = (code: string) => Number(accountByCode(accounts, code)?.balance ?? 0);
  const rangeLabel = t(`ranges.${range.value}`);
  const span = t('lastRange', { range: rangeLabel });
  // A window that starts before the books did holds only part of its days —
  // "+8,700% vs the 90 days before" would be comparing against nothing.
  const comparable = before.from >= overview.openingAsOf;
  const compare = (now: number, then: number) => (comparable ? change(now, then) : null);

  const revenue = Number(pnl.revenue);
  const netProfit = Number(pnl.netProfit);
  const costs = revenue - netProfit;
  // A share of sales means something only between −100% and 100%; past that
  // (sales of 3,500 against 40,000 of costs) it reads as noise, so it's left out.
  const share = (v: number) => (revenue > 0 && Math.abs(v) <= revenue ? `${((v / revenue) * 100).toFixed(1)}%` : '');

  const owedToYou = [
    { key: 'noon', label: t('home.noon'), amount: balance('NOON_RECEIVABLE'), href: '/' },
    { key: 'customers', label: t('home.customers'), amount: balance('CUSTOMER_RECEIVABLE'), href: '/sales?view=due' },
    { key: 'cod', label: t('home.cod'), amount: Number(orders.deliveredUnpaidAmount), href: '/orders?status=DELIVERED&paymentStatus=UNPAID' },
    { key: 'bosta', label: t('home.bosta'), amount: balance('BOSTA_COD'), href: '/shipments' },
    { key: 'cheques', label: t('home.cheques'), amount: balance('CHEQUES_PENDING'), href: '/money/treasury' },
    { key: 'amazon', label: t('home.amazon'), amount: balance('AMAZON_RECEIVABLE'), href: '/money/ledger?code=AMAZON_RECEIVABLE' },
  ].filter((r) => r.amount > 0.005);
  const youOwe = [
    { key: 'suppliers', label: t('home.suppliers'), amount: balance('SUPPLIER_PAYABLE'), href: '/money/purchases?view=due' },
    { key: 'refunds', label: t('home.refunds'), amount: balance('CUSTOMER_REFUNDS'), href: '/orders?paymentStatus=REFUND_DUE' },
  ].filter((r) => r.amount > 0.005);

  return (
    <Page>
      <PageHeader
        title={t('title')}
        description={t('home.description')}
        actions={
          <PeriodTabs
            value={range.value}
            options={RANGES.map((r) => ({ value: r.value, label: t(`ranges.${r.value}`) }))}
            href={(v) => (v === DEFAULT_RANGE ? '/money' : `/money?range=${v}`)}
          />
        }
      />

      {/* 1. The answer: net profit for the period, its chart, and the four figures behind it. */}
      <section className="overflow-hidden rounded-2xl border bg-card" data-sensitive-scope>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-6 pt-6 md:px-8 md:pt-7">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('pnl.netProfitFor', { span })}</p>
            <p className="mt-2 flex items-baseline gap-2.5">
              <Amount
                value={netProfit}
                className={cn('text-[40px] leading-none font-semibold tracking-[-0.03em] md:text-[52px]', netProfit < 0 && 'text-destructive')}
              />
              <span className="text-sm text-muted-foreground">{tr('common.egp')}</span>
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
              <Change value={compare(netProfit, Number(pnlBefore.netProfit))} note={t('vsBefore', { range: rangeLabel })} />
              <span>
                {netProfit < 0
                  ? t('pnl.lossNote', { amount: money(-netProfit) })
                  : share(netProfit) && t('pnl.margin', { margin: share(netProfit) })}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Key color="var(--primary)" label={t('pnl.salesSoFar')} />
            <Key color="var(--muted-foreground)" label={t('pnl.costsSoFar')} line />
          </div>
        </div>
        <div className="px-3 pt-6 pb-2 md:px-5">
          <ProfitTrendChart series={pnl.series} bucket={range.bucket} className="h-64 md:h-72" />
        </div>
        <dl className="grid grid-cols-2 border-t md:grid-cols-4 max-md:[&>*:nth-child(even)]:border-s max-md:[&>*:nth-child(n+3)]:border-t md:[&>*+*]:border-s">
          <Figure label={t('pnl.revenue')} value={<Amount value={revenue} />}>
            <Change value={compare(revenue, Number(pnlBefore.revenue))} />
          </Figure>
          <Figure label={t('pnl.costs')} value={<Amount value={costs} />}>
            <Change value={compare(costs, Number(pnlBefore.revenue) - Number(pnlBefore.netProfit))} invert />
          </Figure>
          <Figure label={t('pnl.grossProfit')} value={<Amount value={pnl.grossProfit} />}>
            {share(Number(pnl.grossProfit)) ? t('pnl.margin', { margin: share(Number(pnl.grossProfit)) }) : t('pnl.afterCogs')}
          </Figure>
          <Figure label={tr('charts.cashOnHand')} value={<Amount value={balance('CASH')} />} href="/money/treasury">
            {t('home.cashHint')}
          </Figure>
        </dl>
        {pnl.uncostedUnits > 0 ? (
          <p className="border-t bg-warning-subtle/60 px-6 py-3 text-xs leading-relaxed text-warning md:px-8">
            {t.rich('pnl.uncosted', { count: pnl.uncostedUnits, b: (c) => <b className="font-semibold">{c}</b> })}{' '}
            <Link href="/products" className="font-medium underline underline-offset-4">{t('pnl.uncostedFix')}</Link>
          </p>
        ) : null}
      </section>

      {/* 2. How it got there: the statement, and where the sales came from. */}
      <section className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-2 max-lg:[&>*+*]:border-t lg:[&>*+*]:border-s" data-sensitive-scope>
        <div className="px-6 py-6 md:px-8">
          <h2 className="text-base font-semibold">{t('pnl.statement')}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{span}</p>
          <Statement pnl={pnl} share={share} expensesHref={`/money/expenses?from=${from}&to=${to}`} />
        </div>
        <div className="px-6 py-6 md:px-8">
          <h2 className="text-base font-semibold">{t('pnl.channelsTitle')}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('pnl.channelsHint', { span })}</p>
          <Channels pnl={pnl} revenue={revenue} />
        </div>
      </section>

      {/* 3. Who owes whom: what will come in, what will go out, and the difference. */}
      <section className="overflow-hidden rounded-2xl border bg-card" data-sensitive-scope>
        <div className="grid md:grid-cols-2 max-md:[&>*+*]:border-t md:[&>*+*]:border-s">
          <Owed title={t('home.owedToYou')} hint={t('home.owedToYouHint')} rows={owedToYou} empty={t('home.owedNone')} />
          <Owed title={t('home.youOwe')} hint={t('home.youOweHint')} rows={youOwe} empty={t('home.oweNone')} owing />
        </div>
        <NetOwed owed={owedToYou.reduce((n, r) => n + r.amount, 0)} owe={youOwe.reduce((n, r) => n + r.amount, 0)} />
      </section>

      <nav aria-label={t('pnl.more')} className="flex flex-wrap gap-2 px-1">
        {[
          { href: '/money/treasury', label: tr('nav.items.treasury') },
          { href: '/money/expenses', label: tr('nav.items.expenses') },
          { href: '/money/purchases', label: tr('nav.items.purchases') },
          { href: '/money/ledger', label: tr('nav.items.ledger') },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {l.label}
            <ChevronLeft className="size-3.5 ltr:rotate-180" aria-hidden />
          </Link>
        ))}
      </nav>
    </Page>
  );
}

/** One of the figures under the chart: what it is, how much, and against what. */
function Figure({ label, value, href, children }: { label: string; value: ReactNode; href?: string; children: ReactNode }) {
  const body = (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="num mt-1.5 text-xl font-semibold tracking-[-0.02em]">{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{children}</dd>
    </>
  );
  return href ? (
    <Link href={href} className="block px-6 py-4 transition-colors hover:bg-muted/40 md:px-8">{body}</Link>
  ) : (
    <div className="px-6 py-4 md:px-8">{body}</div>
  );
}

/**
 * Sales down to net profit, the way an accountant would write it on paper:
 * each cost taken off in turn, subtotals ruled off, the result in bold. A line
 * not calculated yet keeps its place, marked — never a made-up figure.
 */
async function Statement({ pnl, share, expensesHref }: { pnl: PerformanceReport; share: (v: number) => string; expensesHref: string }) {
  const t = await getTranslations('money.pnl');
  const estimate = pnl.channels.some((c) => c.cogsBasis === 'estimate' && Number(c.cogs) > 0) || pnl.uncostedUnits > 0;
  const less = (label: string, value: string, note?: string, href?: string) => ({ label, value: -Number(value), note, href, less: true });
  const rows: Array<{ label: string; value: number | null; note?: string; href?: string; total?: 'sub' | 'final'; less?: boolean }> = [
    { label: t('revenue'), value: Number(pnl.revenue) },
    less(t('cogs'), pnl.cogs, estimate ? t('estimated') : undefined),
    { label: t('grossProfit'), value: Number(pnl.grossProfit), total: 'sub' },
    less(t('fees'), pnl.fees),
    less(t('shipping'), pnl.shipping),
    less(t('expenses'), pnl.expenses, undefined, expensesHref),
    { label: t('taxes'), value: null, note: t('notYet'), less: true },
    { label: t('netProfit'), value: Number(pnl.netProfit), total: 'final' },
  ];
  return (
    <dl className="mt-5 grid text-sm">
      {rows.map((r) => {
        const label = (
          <span className={cn(r.total ? 'font-semibold' : r.less ? 'ps-4 text-muted-foreground' : 'font-medium')}>
            {r.label}
            {r.note ? <span className="ms-2 rounded-full bg-muted px-2 py-px text-[10.5px] font-medium text-muted-foreground">{r.note}</span> : null}
          </span>
        );
        return (
          <div
            key={r.label}
            className={cn(
              'flex items-baseline justify-between gap-4 py-2',
              r.total === 'sub' && 'mt-1 border-t pt-3',
              r.total === 'final' && 'mt-2 border-t-2 border-foreground/20 pt-3.5',
            )}
          >
            <dt>{r.href ? <Link href={r.href} className="underline-offset-4 hover:underline">{label}</Link> : label}</dt>
            <dd className="flex items-baseline gap-3">
              {r.total ? <span className="num text-xs text-muted-foreground">{share(r.value ?? 0)}</span> : null}
              {r.value === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Amount
                  value={r.value}
                  className={cn(
                    r.total === 'final'
                      ? cn('text-lg font-semibold', r.value < 0 ? 'text-destructive' : 'text-success')
                      : r.total
                        ? 'font-semibold'
                        : r.less
                          ? 'text-muted-foreground'
                          : 'font-medium',
                  )}
                />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Each channel's sales and its part of the whole, biggest first; Amazon waits in its row until connected. */
async function Channels({ pnl, revenue }: { pnl: PerformanceReport; revenue: number }) {
  const t = await getTranslations('money.pnl');
  const rows = [...pnl.channels].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  return (
    <ul className="mt-5 grid gap-4">
      {rows.map((c) => {
        const sold = Number(c.revenue);
        const left = Number(c.contribution);
        const part = revenue > 0 ? sold / revenue : 0;
        return (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="font-medium">{t(`channels.${c.key}`)}</span>
              <Amount value={sold} className={cn('font-semibold', sold === 0 && 'font-normal text-muted-foreground')} />
            </div>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(part * 100, sold > 0 ? 1 : 0)}%` }} />
            </span>
            <p className="mt-1.5 flex flex-wrap justify-between gap-x-4 text-xs text-muted-foreground">
              <span>
                {sold > 0
                  ? `${Math.round(part * 100)}% · ${t(`counts.${c.key === 'wholesale' ? 'invoices' : 'orders'}`, { count: c.count })}`
                  : t('noSales')}
              </span>
              {sold > 0 ? (
                <span className={cn(c.uncostedUnits > 0 && 'text-warning')}>
                  {c.uncostedUnits > 0
                    ? t('uncostedShort', { count: c.uncostedUnits })
                    : t('leftAfter', { amount: money(left), margin: `${((left / sold) * 100).toFixed(0)}%` })}
                </span>
              ) : null}
            </p>
          </li>
        );
      })}
      <li className="text-sm text-muted-foreground">
        <div className="flex items-baseline justify-between gap-4">
          <span>{t('channels.amazon')}</span>
          <span className="text-xs">{t('notConnected')}</span>
        </div>
        <span className="mt-2 block h-1.5 rounded-full border border-dashed" />
      </li>
    </ul>
  );
}

/** One side of who-owes-whom: its total, what it means, then each part opening its records. */
function Owed({
  title,
  hint,
  rows,
  empty,
  owing = false,
}: {
  title: string;
  hint: string;
  rows: Array<{ key: string; label: string; amount: number; href: string }>;
  empty: string;
  owing?: boolean;
}) {
  const total = rows.reduce((n, r) => n + r.amount, 0);
  return (
    <div className="px-6 py-6 md:px-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <Amount value={total} className={cn('text-2xl font-semibold tracking-tight', owing && total > 0.005 && 'text-warning')} />
      </div>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>
      {rows.length ? (
        <ul className="mt-4 divide-y border-t">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="group flex items-center gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate group-hover:text-highlight">{r.label}</span>
                <span className="num font-medium">{money(r.amount)}</span>
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

/** The difference, said in a sentence — which way it leans, and by how much. */
async function NetOwed({ owed, owe }: { owed: number; owe: number }) {
  const t = await getTranslations('money.home');
  const net = owed - owe;
  if (Math.abs(net) < 0.005 && owed < 0.005) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t bg-muted/30 px-6 py-3.5 text-sm md:px-8">
      <span className="text-muted-foreground">{t(net >= 0 ? 'netOwedToYou' : 'netYouOwe')}</span>
      <Amount value={Math.abs(net)} className={cn('font-semibold', net < 0 && 'text-warning')} />
    </p>
  );
}

/**
 * A change against the period before, as words with a small arrow — not a
 * coloured pill. `invert` is for figures where less is better (costs). Nothing
 * to compare with, nothing shown.
 */
function Change({ value, invert = false, note }: { value: number | null; invert?: boolean; note?: string }) {
  if (value === null) return note ? null : <span>—</span>;
  const flat = Math.abs(value) < 0.05;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const good = invert ? value < 0 : value > 0;
  return (
    <span>
      <span className={cn('inline-flex items-center gap-0.5 font-medium', !flat && (good ? 'text-success' : 'text-destructive'))}>
        <Icon className="size-3.5" />
        <bdi className="num">{`${Math.abs(value).toFixed(1)}%`}</bdi>
      </span>
      {note ? <> {note}</> : null}
    </span>
  );
}

/** A chart's key: a swatch (or a short line, for a line series) and its name. */
function Key({ color, label, line = false }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={line ? 'h-0.5 w-3 rounded-full' : 'size-2 rounded-[2px]'} style={{ background: color }} />
      {label}
    </span>
  );
}
