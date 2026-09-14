'use client';

import { useRouter } from 'next/navigation';
import { useId, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import type { Period } from '@/lib/api';
import { money, monthLabel } from '@/lib/format';

/**
 * Every chart in the app, on shadcn's chart (Recharts underneath). Each one is
 * fed straight from an API aggregate — none of them sums a page of rows — and
 * colours come from the theme: teal for the brand's own figures, success and
 * destructive only where a value means money in or out.
 */

export type Bucket = 'day' | 'week' | 'month';

/** `1,250,000` → `1.3M` — axis ticks only, where the exact figure is noise. */
const compact = (v: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** A bucket's start date as an axis tick, or in full for a tooltip. */
function periodLabel(iso: string, bucket: Bucket, long = false) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (bucket === 'month') {
    return d.toLocaleDateString('en-GB', {
      month: long ? 'long' : 'short',
      year: long ? 'numeric' : '2-digit',
      timeZone: 'UTC',
    });
  }
  const day = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: long ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
  return bucket === 'week' && long ? `Week of ${day}` : day;
}

/** Signed money for a tooltip: `+490.00`, `−10,000.00`. */
const signedMoney = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v));

/** A gradient id that's safe inside `url(#…)`. */
function useGradientId() {
  return `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

function ChartEmpty({ children, className = 'h-64' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-center text-[13px] text-muted-foreground ${className}`}>
      {children}
    </div>
  );
}

const sparkConfig = { balance: { label: 'Cash', color: 'var(--chart-4)' } } satisfies ChartConfig;

/** A small trend line under a figure. Flat grey when the period ended lower. */
export function Sparkline({ points }: { points: number[] }) {
  const id = useGradientId();
  if (points.length < 2) return null;
  const rising = points[points.length - 1] >= points[0];
  const stroke = rising ? 'var(--color-balance)' : 'var(--muted-foreground)';
  return (
    <ChartContainer config={sparkConfig} className="aspect-auto h-8 w-full" aria-hidden>
      <AreaChart data={points.map((balance, i) => ({ i, balance }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Area
          dataKey="balance"
          type="monotone"
          stroke={stroke}
          strokeWidth={1.5}
          fill={`url(#${id})`}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

const balanceConfig = { balance: { label: 'Cash on hand', color: 'var(--chart-4)' } } satisfies ChartConfig;

/** The treasury's closing balance, day by day. */
export function CashBalanceChart({
  series,
  className = 'h-64',
}: {
  series: Array<{ date: string; balance: string }>;
  className?: string;
}) {
  const id = useGradientId();
  if (series.length < 2) {
    return <ChartEmpty className={className}>Not enough history yet — the chart fills in as days pass.</ChartEmpty>;
  }
  const data = series.map((p) => ({ date: p.date, balance: Number(p.balance) }));
  return (
    <ChartContainer config={balanceConfig} className={`aspect-auto w-full ${className}`}>
      <AreaChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={40}
          tickFormatter={(v: string) => periodLabel(v, 'day')}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          domain={['auto', 'auto']}
          tickFormatter={compact}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(v) => periodLabel(String(v), 'day', true)}
              valueFormatter={money}
            />
          }
        />
        <Area
          dataKey="balance"
          type="monotone"
          stroke="var(--color-balance)"
          strokeWidth={2}
          fill={`url(#${id})`}
        />
      </AreaChart>
    </ChartContainer>
  );
}

const flowConfig = {
  in: { label: 'Money in', color: 'var(--success)' },
  out: { label: 'Money out', color: 'var(--destructive)' },
} satisfies ChartConfig;

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
  const data = series.map((p) => ({ period: p.period, in: Number(p.in), out: -Number(p.out) }));
  if (data.every((d) => d.in === 0 && d.out === 0)) {
    return <ChartEmpty>No money moved in this period.</ChartEmpty>;
  }
  return (
    <ChartContainer config={flowConfig} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => periodLabel(v, bucket)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => compact(Math.abs(v))}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', fillOpacity: 0.6 }}
          content={
            <ChartTooltipContent
              labelFormatter={(v) => periodLabel(String(v), bucket, true)}
              valueFormatter={signedMoney}
            />
          }
        />
        <Bar dataKey="in" stackId="flow" fill="var(--color-in)" maxBarSize={36} />
        <Bar dataKey="out" stackId="flow" fill="var(--color-out)" maxBarSize={36} />
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

const listConfig = { size: { label: 'Amount' } } satisfies ChartConfig;

/**
 * Horizontal bars, label on the left and amount at the end — for "what made
 * this up" breakdowns. Labels sit in their own column, not inside the bar, so
 * a small amount's label never has to squeeze into a small bar. A bar with an
 * `href` opens the records behind it.
 */
export function BarList({ items, empty }: { items: BarItem[]; empty: string }) {
  const router = useRouter();
  if (items.length === 0) return <ChartEmpty className="h-24">{empty}</ChartEmpty>;
  const data = items.map((i) => ({ ...i, size: Math.abs(i.value) }));
  return (
    <ChartContainer config={listConfig} className="aspect-auto w-full" style={{ height: items.length * 36 }}>
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 84, bottom: 0, left: 0 }}
        barCategoryGap={6}
      >
        <YAxis
          dataKey="label"
          type="category"
          width={176}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--foreground)' }}
        />
        <XAxis dataKey="size" type="number" hide domain={[0, 'dataMax']} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideIndicator nameKey="label" valueFormatter={money} />}
        />
        <Bar
          dataKey="size"
          minPointSize={3}
          className={data.some((i) => i.href) ? 'cursor-pointer' : undefined}
          onClick={(bar: { payload?: BarItem }) => {
            if (bar.payload?.href) router.push(bar.payload.href);
          }}
        >
          {data.map((i) => (
            <Cell key={i.key} fill={i.fill} fillOpacity={0.6} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            offset={8}
            className="num fill-foreground"
            fontSize={12}
            formatter={(v) => signedOrPlain(Number(v))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Amounts in a breakdown read unsigned unless they're below zero. */
const signedOrPlain = (v: number) => (v < 0 ? '−' : '') + money(Math.abs(v));

const monthsConfig = { netProceeds: { label: 'Net proceeds', color: 'var(--chart-3)' } } satisfies ChartConfig;

/** noon's net proceeds per settlement month; a bar opens its month. */
export function MonthlyProceedsChart({ periods }: { periods: Period[] }) {
  const router = useRouter();
  const data = [...periods]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((p) => ({ ...p, netProceeds: Number(p.netProceeds) }));
  return (
    <ChartContainer config={monthsConfig} className="aspect-auto h-60 w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(m: string) => periodLabel(`${m}-01`, 'month')}
        />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={compact} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', fillOpacity: 0.6 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as Period | undefined;
                return p ? `${monthLabel(p.month)} · ${p.unitsSold.toLocaleString('en-GB')} units` : '';
              }}
              valueFormatter={money}
            />
          }
        />
        <Bar
          dataKey="netProceeds"
          fill="var(--color-netProceeds)"
          maxBarSize={48}
          className="cursor-pointer"
          onClick={(bar: { payload?: Period }) => {
            if (bar.payload?.month) router.push(`/months/${bar.payload.month}`);
          }}
        />
      </BarChart>
    </ChartContainer>
  );
}
