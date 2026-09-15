'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  LabelList,
  Line,
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
 * fed straight from an API aggregate — none of them sums a page of rows — and
 * colours come from the theme: teal for the brand's own figures, success and
 * destructive only where a value means money in or out.
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

/** A gradient id that's safe inside `url(#…)`. */
function useGradientId() {
  return `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

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

const sparkConfig = { balance: { color: 'var(--chart-4)' } } satisfies ChartConfig;

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
  const id = useGradientId();
  const axisWidth = useAxisWidth();
  const tick = useTick();
  if (series.length < 2) {
    return <ChartEmpty className={className}>{t('notEnoughHistory')}</ChartEmpty>;
  }
  const config = { balance: { label: t('cashOnHand'), color: 'var(--chart-4)' } } satisfies ChartConfig;
  const data = series.map((p) => ({ date: p.date, balance: Number(p.balance) }));
  return (
    <ChartContainer config={config} className={`aspect-auto w-full ${className}`}>
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
          tickFormatter={(v: string) => tick(f.dayShort(v))}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={axisWidth}
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
          strokeWidth={2}
          fill={`url(#${id})`}
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
    in: { label: t('moneyIn'), color: 'var(--success)' },
    out: { label: t('moneyOut'), color: 'var(--destructive)' },
  } satisfies ChartConfig;
  const weekOf = (date: string) => t('weekOf', { date });
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => tick(bucketLabel(f, weekOf, v, bucket))}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={axisWidth}
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
        <Bar dataKey="in" stackId="flow" fill="var(--color-in)" maxBarSize={36} />
        <Bar dataKey="out" stackId="flow" fill="var(--color-out)" maxBarSize={36} />
      </BarChart>
    </ChartContainer>
  );
}

/**
 * Revenue, split into what it cost, over time — cost of goods and channel
 * fees stacked from the bottom, gross profit on top so its own height already
 * reads as "what's left", with the margin trend as a line against its own
 * axis. Every bucket present, same as the other time-series charts here.
 */
export function ProfitChart({
  series,
  bucket,
}: {
  series: Array<{
    period: string;
    revenue: string;
    cogs: string;
    channelFees: string;
    grossProfit: string;
  }>;
  bucket: Bucket;
}) {
  const t = useTranslations('charts');
  const tm = useTranslations('money.overview');
  const tr = useTranslations();
  const f = useFormat();
  const axisWidth = useAxisWidth();
  const tick = useTick();
  const rtl = useDirection() === 'rtl';

  const data = series.map((p) => {
    const revenue = Number(p.revenue);
    const grossProfit = Number(p.grossProfit);
    return {
      period: p.period,
      cogs: Number(p.cogs),
      channelFees: Number(p.channelFees),
      grossProfit: Math.max(grossProfit, 0),
      margin: revenue > 0.005 ? Math.round((grossProfit / revenue) * 1000) / 10 : null,
      revenue,
    };
  });

  if (data.every((d) => d.revenue === 0)) {
    return <ChartEmpty className="h-80">{tm('noCosts')}</ChartEmpty>;
  }

  const config = {
    cogs: { label: tm('costOfGoods'), color: 'var(--muted-foreground)' },
    channelFees: { label: tr('enums.cashOut.CHANNEL_FEES'), color: 'var(--muted-foreground)' },
    grossProfit: { label: tm('grossProfit'), color: 'var(--chart-4)' },
    margin: { label: t('grossMargin'), color: 'var(--chart-2)' },
  } satisfies ChartConfig;
  const weekOf = (date: string) => t('weekOf', { date });

  return (
    <ChartContainer key={rtl ? 'rtl' : 'ltr'} config={config} className="aspect-auto h-80 w-full">
      <ComposedChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => tick(bucketLabel(f, weekOf, v, bucket))}
        />
        <YAxis
          yAxisId="amount"
          orientation={rtl ? 'right' : 'left'}
          tickLine={false}
          axisLine={false}
          width={axisWidth}
          tickFormatter={(v: number) => tick(f.compact(v))}
        />
        <YAxis
          yAxisId="margin"
          orientation={rtl ? 'left' : 'right'}
          tickLine={false}
          axisLine={false}
          width={36}
          domain={[0, (max: number) => Math.max(Math.ceil(max / 10) * 10, 10)]}
          tickFormatter={(v: number) => `${tick(String(v))}%`}
        >
          <Label
            value={t('grossMargin')}
            position={rtl ? 'insideLeft' : 'insideRight'}
            angle={-90}
            offset={rtl ? -4 : 8}
            style={{ fontSize: 11, fill: 'var(--muted-foreground)', textAnchor: 'middle' }}
          />
        </YAxis>
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', fillOpacity: 0.5 }}
          content={
            <ChartTooltipContent
              labelFormatter={(v) => bucketLabel(f, weekOf, String(v), bucket, true)}
              formatter={(value, _name, item, index) => (
                <div key={index} className="flex w-full flex-1 items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color ?? (item.payload as { fill?: string })?.fill }}
                  />
                  <span className="flex-1 text-muted-foreground">
                    {config[item.dataKey as keyof typeof config]?.label}
                  </span>
                  <span className="num font-medium text-foreground">
                    {item.dataKey === 'margin' ? (value === null ? '—' : `${value}%`) : money(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar yAxisId="amount" dataKey="cogs" stackId="p" fill="var(--color-cogs)" fillOpacity={0.45} />
        <Bar yAxisId="amount" dataKey="channelFees" stackId="p" fill="var(--color-channelFees)" fillOpacity={0.25} />
        <Bar
          yAxisId="amount"
          dataKey="grossProfit"
          stackId="p"
          fill="var(--color-grossProfit)"
          radius={rtl ? [0, 0, 0, 0] : [0, 0, 0, 0]}
          maxBarSize={44}
        />
        <Line
          yAxisId="margin"
          type="monotone"
          dataKey="margin"
          stroke="var(--color-margin)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </ComposedChart>
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
 * Horizontal bars, label then bar then amount — for "what made this up"
 * breakdowns. Labels sit in their own column, not inside the bar, so a small
 * amount's label never squeezes into a small bar. In Arabic the whole row
 * mirrors: label on the right, bar growing leftward, amount at its end. A bar
 * with an `href` opens the records behind it.
 */
export function BarList({ items, empty }: { items: BarItem[]; empty: string }) {
  const t = useTranslations('charts');
  const router = useRouter();
  const rtl = useDirection() === 'rtl';
  if (items.length === 0) return <ChartEmpty className="h-24">{empty}</ChartEmpty>;
  const config = { size: { label: t('amount') } } satisfies ChartConfig;
  const data = items.map((i) => ({ ...i, size: Math.abs(i.value) }));
  return (
    // Keyed by direction: Recharts keeps a reversed axis's geometry across a
    // language switch, so a new direction gets a fresh chart.
    <ChartContainer
      key={rtl ? 'rtl' : 'ltr'}
      config={config}
      className="aspect-auto w-full"
      style={{ height: items.length * 36 }}
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={rtl ? { top: 0, right: 0, bottom: 0, left: 84 } : { top: 0, right: 84, bottom: 0, left: 0 }}
        barCategoryGap={6}
      >
        <YAxis
          dataKey="label"
          type="category"
          orientation={rtl ? 'right' : 'left'}
          width={176}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--foreground)' }}
        />
        <XAxis dataKey="size" type="number" hide reversed={rtl} domain={[0, 'dataMax']} />
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
          {/* "right" is past the bar's end in both directions: on the reversed
              axis bars have negative width, and Recharts flips the side. */}
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

/** noon's net proceeds per settlement month; a bar opens its month. */
export function MonthlyProceedsChart({ periods }: { periods: Period[] }) {
  const t = useTranslations('charts');
  const tn = useTranslations('nouns');
  const f = useFormat();
  const router = useRouter();
  const axisWidth = useAxisWidth();
  const tick = useTick();
  const config = { netProceeds: { label: t('netProceeds'), color: 'var(--chart-3)' } } satisfies ChartConfig;
  const data = [...periods]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((p) => ({ ...p, netProceeds: Number(p.netProceeds) }));
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
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
