'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
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
import { useIsMobile } from '@/hooks/use-mobile';
import type { Format } from '@/i18n/format';
import { useFormat } from '@/i18n/use-format';
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

/**
 * The period at a glance, as running totals: sales so far as a filled area,
 * costs so far as a line. The gap between them is the profit; where the line
 * rises above the area, the period is losing money. Running totals read far
 * better than day-by-day figures, which swing with every large payment.
 */
export function ProfitTrendChart({
  series,
  bucket,
  className = 'h-72',
}: {
  series: Array<{ period: string; revenue: string; costs: string; netProfit: string }>;
  bucket: Bucket;
  className?: string;
}) {
  const t = useTranslations('money.pnl');
  const tc = useTranslations('charts');
  const f = useFormat();
  const axisWidth = useAxisWidth();
  const tick = useTick();
  const rtl = useDirection() === 'rtl';
  const mobile = useIsMobile();
  const data = series.reduce<Array<{ period: string; revenue: number; costs: number; netProfit: number }>>((sofar, p) => {
    const last = sofar.at(-1) ?? { revenue: 0, costs: 0 };
    const revenue = last.revenue + Number(p.revenue);
    const costs = last.costs + Number(p.costs);
    return [...sofar, { period: p.period, revenue, costs, netProfit: revenue - costs }];
  }, []);
  if (data.every((d) => d.revenue === 0 && d.costs === 0)) {
    return <ChartEmpty className={className}>{t('trendEmpty')}</ChartEmpty>;
  }
  const config = {
    revenue: { label: t('salesSoFar'), color: 'var(--primary)' },
    costs: { label: t('costsSoFar'), color: 'var(--muted-foreground)' },
    netProfit: { label: t('netProfit'), color: 'transparent' },
  } satisfies ChartConfig;
  const weekOf = (date: string) => tc('weekOf', { date });
  return (
    <ChartContainer key={rtl ? 'rtl' : 'ltr'} config={config} className={`aspect-auto w-full ${className}`}>
      <ComposedChart accessibilityLayer data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={28}
          tickFormatter={(v: string) => tick(bucketLabel(f, weekOf, v, bucket))}
        />
        {/* On a phone the value axis would crowd the curve; the tooltip gives exact figures instead. */}
        <YAxis
          hide={mobile}
          orientation={rtl ? 'right' : 'left'}
          tickCount={5}
          tickLine={false}
          axisLine={false}
          width={axisWidth}
          tickFormatter={(v: number) => tick(f.compact(v))}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--border)' }}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(v) => bucketLabel(f, weekOf, String(v), bucket, true)}
              valueFormatter={signedOrPlain}
            />
          }
        />
        <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} fill="var(--color-revenue)" fillOpacity={0.12} />
        <Line dataKey="costs" type="monotone" stroke="var(--color-costs)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
        {/* Not drawn, on its own hidden scale — there so the tooltip says the profit at each point. */}
        <YAxis yAxisId="profit" hide />
        <Line yAxisId="profit" dataKey="netProfit" stroke="transparent" dot={false} activeDot={false} legendType="none" />
      </ComposedChart>
    </ChartContainer>
  );
}
