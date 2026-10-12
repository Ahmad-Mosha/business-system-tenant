'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useDirection } from '@/components/ui/direction';
import type { Format } from '@/i18n/format';
import { useFormat } from '@/i18n/use-format';
import type { Period } from '@/lib/api';
import { money } from '@/lib/format';

/**
 * Every chart in the app, on shadcn's chart (Recharts underneath). Each one is
 * fed straight from an API aggregate — none of them sums a page of rows. The
 * look is deliberately plain: thin lines, flat fills, dashed hairline grids, no
 * gradients. Teal is money in and the business's own figures; money out is a
 * quiet grey, not alarm red — red is kept for a value below zero.
 *
 * Right-to-left, by kind rather than blanket mirroring: time series keep time
 * running left to right, the most common pattern in Arabic charts and the way
 * the digits themselves read; breakdowns — labels and bars — mirror, so a
 * label sits where an Arabic reader starts. Axis ticks, tooltips and legends
 * are in the reader's language either way.
 */

export type Bucket = 'day' | 'week' | 'month';

/** A bucket's start as an axis tick, or in full for a tooltip. */
function bucketLabel(f: Format, weekOf: (date: string) => string, iso: string, bucket: Bucket, long = false) {
  if (bucket === 'month') return long ? f.month(iso.slice(0, 7)) : f.monthShort(iso.slice(0, 7));
  if (!long) return f.dayShort(iso);
  const full = f.date(`${iso}T12:00:00Z`);
  return bucket === 'week' ? weekOf(full) : full;
}

/** Signed money for a tooltip: `+490.00`, `−10,000.00`. */
const signedMoney = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v));

/** Amounts in a breakdown read unsigned unless they're below zero. */
const signedOrPlain = (v: number) => (v < 0 ? '−' : '') + money(Math.abs(v));

/** Money out, in charts and breakdowns: present, but never louder than money in. */
export const OUT_FILL = 'color-mix(in srgb, var(--foreground) 28%, transparent)';

/** Room for the value axis — Arabic compact figures ("1.1 مليون") run longer. */
const useAxisWidth = () => (useDirection() === 'rtl' ? 64 : 52);

/**
 * A tick label inside the chart's left-to-right SVG. An Arabic one ("17 أغسطس",
 * "850 ألف") is isolated right-to-left — laid out left to right, its number
 * lands on the wrong side of the word.
 */
function useTick() {
  const rtl = useDirection() === 'rtl';
  return (label: string) => (rtl ? `\u2067${label}\u2069` : label);
}

function ChartEmpty({ children, className = 'h-64' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-center text-[13px] text-muted-foreground ${className}`}>
      {children}
    </div>
  );
}

/** The treasury's closing balance, day by day. */
export function CashBalanceChart({
  series,
  className = 'h-64',
}: {
  series: Array<{ date: string; balance: string }>;
  className?: string;
}) {
  const t = useTranslations('charts');
  const f = useFormat();
  const axisWidth = useAxisWidth();
  const tick = useTick();
  if (series.length < 2) {
    return <ChartEmpty className={className}>{t('notEnoughHistory')}</ChartEmpty>;
  }
  const config = { balance: { label: t('cashOnHand'), color: 'var(--primary)' } } satisfies ChartConfig;
  const data = series.map((p) => ({ date: p.date, balance: Number(p.balance) }));
  return (
    <ChartContainer config={config} className={`aspect-auto w-full ${className}`}>
      <AreaChart accessibilityLayer data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={48}
          tickFormatter={(v: string) => tick(f.dayShort(v))}
        />
        <YAxis
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={axisWidth}
          tickCount={4}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => tick(f.compact(v))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(v) => f.date(`${String(v)}T12:00:00Z`)}
              valueFormatter={money}
            />
          }
        />
        <Area
          dataKey="balance"
          type="monotone"
          stroke="var(--color-balance)"
          strokeWidth={1.75}
          fill="var(--color-balance)"
          fillOpacity={0.06}
          activeDot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--card)' }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/**
 * Money in above the line, money out below it — one bar pair per day, week or
 * month, so which way cash moved reads before any number does.
 */
export function CashFlowChart({
  series,
  bucket,
}: {
  series: Array<{ period: string; in: string; out: string }>;
  bucket: Bucket;
}) {
  const t = useTranslations('charts');
  const f = useFormat();
  const axisWidth = useAxisWidth();
  const tick = useTick();
  const data = series.map((p) => ({ period: p.period, in: Number(p.in), out: -Number(p.out) }));
  if (data.every((d) => d.in === 0 && d.out === 0)) {
    return <ChartEmpty>{t('noMovement')}</ChartEmpty>;
  }
  const config = {
    in: { label: t('moneyIn'), color: 'var(--primary)' },
    out: { label: t('moneyOut'), color: OUT_FILL },
  } satisfies ChartConfig;
  const weekOf = (date: string) => t('weekOf', { date });
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data} stackOffset="sign" margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={24}
          tickFormatter={(v: string) => tick(bucketLabel(f, weekOf, v, bucket))}
        />
        <YAxis
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={axisWidth}
          tickCount={5}
          tickFormatter={(v: number) => tick(f.compact(Math.abs(v)))}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', fillOpacity: 0.6 }}
          content={
            <ChartTooltipContent
              labelFormatter={(v) => bucketLabel(f, weekOf, String(v), bucket, true)}
              valueFormatter={signedMoney}
            />
          }
        />
        <Bar dataKey="in" stackId="flow" fill="var(--color-in)" radius={[2, 2, 0, 0]} maxBarSize={22} />
        <Bar dataKey="out" stackId="flow" fill="var(--color-out)" radius={[2, 2, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ChartContainer>
  );
}

/** The confirmed manual/Easy Order business-profit measure over time. */
export function ProfitChart({
  series,
  bucket,
}: {
  series: Array<{
    period: string;
    sales: string;
    shipping: string;
    businessProfit: string;
  }>;
  bucket: Bucket;
}) {
  const t = useTranslations('charts');
  const tm = useTranslations('money.overview');
  const f = useFormat();
  const axisWidth = useAxisWidth();
  const tick = useTick();
  const rtl = useDirection() === 'rtl';

  const data = series.map((p) => ({
    period: p.period,
    sales: Number(p.sales),
    shipping: Number(p.shipping),
    businessProfit: Number(p.businessProfit),
  }));

  if (data.every((d) => d.sales === 0 && d.shipping === 0)) {
    return <ChartEmpty className="h-64">{tm('businessProfitEmpty')}</ChartEmpty>;
  }

  const config = {
    businessProfit: { label: tm('businessProfit'), color: 'var(--primary)' },
  } satisfies ChartConfig;
  const weekOf = (date: string) => t('weekOf', { date });

  return (
    <ChartContainer key={rtl ? 'rtl' : 'ltr'} config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={24}
          tickFormatter={(v: string) => tick(bucketLabel(f, weekOf, v, bucket))}
        />
        <YAxis
          orientation={rtl ? 'right' : 'left'}
          tickCount={4}
          tickLine={false}
          axisLine={false}
          width={axisWidth}
          tickFormatter={(v: number) => tick(f.compact(v))}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', fillOpacity: 0.5 }}
          content={
            <ChartTooltipContent
              labelFormatter={(v) => bucketLabel(f, weekOf, String(v), bucket, true)}
              valueFormatter={signedMoney}
            />
          }
        />
        <Bar dataKey="businessProfit" fill="var(--color-businessProfit)" radius={[2, 2, 0, 0]} maxBarSize={28}>
          {data.map((point) => (
            <Cell
              key={point.period}
              fill={point.businessProfit < 0 ? 'var(--destructive)' : 'var(--color-businessProfit)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export interface BarItem {
  key: string;
  label: string;
  /** Signed, as it should read; the bar is drawn from its size. */
  value: number;
  fill: string;
  /** Where clicking the bar goes — the records behind it. */
  href?: string;
}

/**
 * A ranked breakdown — "what made this up" — as a plain list: each line its
 * name and amount, with a thin bar underneath scaled to the largest line, and
 * (with `share`) its part of the whole. Plain markup rather than a chart, so it
 * mirrors in Arabic by itself and long names wrap instead of being clipped. A
 * line with an `href` opens the records behind it.
 */
export function BarList({ items, empty, share = true }: { items: BarItem[]; empty: string; share?: boolean }) {
  if (items.length === 0) return <ChartEmpty className="h-24">{empty}</ChartEmpty>;
  const sizes = items.map((i) => Math.abs(i.value));
  const largest = Math.max(...sizes) || 1;
  const whole = sizes.reduce((n, v) => n + v, 0) || 1;
  return (
    <ul className="-mx-2 grid gap-0.5">
      {items.map((i, n) => {
        const line = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">{i.label}</span>
              <span className="flex shrink-0 items-baseline gap-2.5">
                <span className={`num font-medium ${i.value < 0 ? 'text-destructive' : ''}`}>{signedOrPlain(i.value)}</span>
                {share ? (
                  <span className="num w-8 text-end text-xs text-muted-foreground">{`${Math.round((sizes[n] / whole) * 100)}%`}</span>
                ) : null}
              </span>
            </span>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full" style={{ width: `${Math.max((sizes[n] / largest) * 100, 1.5)}%`, background: i.fill }} />
            </span>
          </>
        );
        return (
          <li key={i.key}>
            {i.href ? (
              <Link href={i.href} className="block rounded-md px-2 py-2 text-[13px] transition-colors hover:bg-muted/60">
                {line}
              </Link>
            ) : (
              <div className="px-2 py-2 text-[13px]">{line}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** noon's net proceeds per settlement month; a bar opens its month. */
export function MonthlyProceedsChart({ periods }: { periods: Period[] }) {
  const t = useTranslations('charts');
  const tn = useTranslations('nouns');
  const f = useFormat();
  const router = useRouter();
  const axisWidth = useAxisWidth();
  const tick = useTick();
  const config = { netProceeds: { label: t('netProceeds'), color: 'var(--primary)' } } satisfies ChartConfig;
  const data = [...periods]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((p) => ({ ...p, netProceeds: Number(p.netProceeds) }));
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(m: string) => tick(f.monthShort(m))}
        />
        <YAxis tickLine={false} axisLine={false} width={axisWidth} tickFormatter={(v: number) => tick(f.compact(v))} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', fillOpacity: 0.6 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as Period | undefined;
                return p ? `${f.month(p.month)} · ${tn('units', { count: p.unitsSold })}` : '';
              }}
              valueFormatter={money}
            />
          }
        />
        <Bar
          dataKey="netProceeds"
          fill="var(--color-netProceeds)"
          radius={[2, 2, 0, 0]}
          maxBarSize={36}
          className="cursor-pointer"
          onClick={(bar: { payload?: Period }) => {
            if (bar.payload?.month) router.push(`/months/${bar.payload.month}`);
          }}
        />
      </BarChart>
    </ChartContainer>
  );
}
