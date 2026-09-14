'use client';

import { useId, useState } from 'react';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Hand-rolled SVG charts — the money module needs three simple shapes and none
 * of them justify a charting dependency. Paths live in a stretched SVG; every
 * label and marker is HTML placed by percentage on top, so text never
 * distorts as the card changes width. Theme-aware through CSS variables.
 */

type Point = { date: string; balance: string };

/** A small inline trend line for a metric card. */
export function Sparkline({ points }: { points: number[] }) {
  const id = useId();
  if (points.length < 2) return null;
  const w = 100;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - ((p - min) / span) * (h - 4) - 2]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const rising = points[points.length - 1] >= points[0];
  const stroke = rising ? 'var(--chart-4)' : 'var(--muted-foreground)';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Cash over time: area, faint grid, axis labels, and a hover readout. */
export function CashAreaChart({ series }: { series: Point[] }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (series.length < 2) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        Not enough history yet — the chart fills in as days pass.
      </div>
    );
  }

  const values = series.map((p) => Number(p.balance));
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;
  // Percent coordinates: 0–100 across, 0–100 down.
  const x = (i: number) => (i / (series.length - 1)) * 100;
  const y = (v: number) => 4 + (1 - (v - min) / span) * 92;

  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const last = values.length - 1;
  const at = hover ?? last;

  const ticks: Array<{ i: number; label: string }> = [];
  series.forEach((p, i) => {
    if (i === 0 || p.date.slice(0, 7) !== series[i - 1].date.slice(0, 7)) {
      ticks.push({
        i,
        label: new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
      });
    }
  });
  const grid = [max, min + span / 2, min];

  return (
    <div className="flex h-full gap-3">
      <div className="num flex w-16 shrink-0 flex-col justify-between py-[2%] text-right text-[11px] text-muted-foreground">
        {grid.map((v) => (
          <span key={v}>{compact(v)}</span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="relative min-h-0 flex-1 cursor-crosshair"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.round(((e.clientX - r.left) / r.width) * last));
          }}
          role="img"
          aria-label={`Cash balance over ${series.length} days, now ${money(values[last])}`}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-3)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--chart-3)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {grid.map((v) => (
              <line
                key={v}
                x1={0}
                x2={100}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--border)"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${id})`} />
            <path d={line} fill="none" stroke="var(--chart-4)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            {hover !== null ? (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={0}
                y2={100}
                stroke="var(--foreground)"
                strokeOpacity={0.25}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          <span
            aria-hidden
            className="absolute size-2 -translate-1/2 bg-primary ring-2 ring-card"
            style={{ left: `${x(at)}%`, top: `${y(values[at])}%` }}
          />
          <div
            className={cn(
              'pointer-events-none absolute top-0 bg-popover px-2 py-1 text-xs shadow-md ring-1 ring-foreground/10',
              x(at) > 70 ? '-translate-x-full -ml-2' : 'ml-2',
            )}
            style={{ left: `${x(at)}%` }}
          >
            <p className="text-muted-foreground">{shortDate(series[at].date)}</p>
            <p className="num font-medium">{money(values[at])}</p>
          </div>
        </div>
        <div className="relative mt-2 h-4 text-[11px] text-muted-foreground">
          {ticks.map((t) => (
            <span
              key={t.i}
              className={cn('absolute', t.i > 0 && '-translate-x-1/2')}
              style={{ left: `${x(t.i)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Revenue split into its costs plus the profit left over: one stacked bar,
 * then each part with its share of revenue. Costs are neutral greys — they're
 * not a state — and only the profit segment carries meaning in colour.
 */
export function BreakdownBar({
  revenue,
  segments,
}: {
  revenue: number;
  segments: Array<{ label: string; value: number; tone: 'cost' | 'profit' }>;
}) {
  const total = Math.max(revenue, segments.reduce((s, x) => s + Math.abs(x.value), 0), 1);
  const fill = (seg: { tone: 'cost' | 'profit'; value: number }, i: number) =>
    seg.tone === 'profit'
      ? seg.value >= 0
        ? 'var(--success)'
        : 'var(--destructive)'
      : `color-mix(in oklch, var(--foreground) ${62 - i * 13}%, var(--card))`;

  return (
    <div className="grid gap-3">
      <div className="flex h-2.5 w-full gap-px overflow-hidden bg-muted">
        {segments.map((s, i) => {
          const pct = (Math.abs(s.value) / total) * 100;
          return pct < 0.5 ? null : (
            <div key={s.label} title={`${s.label}: ${money(s.value)}`} style={{ width: `${pct}%`, background: fill(s, i) }} />
          );
        })}
      </div>
      <ul className="grid gap-1.5 text-[13px]">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span aria-hidden className="size-2 shrink-0" style={{ background: fill(s, i) }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="num ms-auto">{money(s.value)}</span>
            <span className="num w-12 text-right text-xs text-muted-foreground">
              {revenue > 0 ? `${((Math.abs(s.value) / revenue) * 100).toFixed(0)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `1,250,000` → `1.25M` — axis labels only, where the exact figure is noise. */
function compact(v: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(v);
}

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
