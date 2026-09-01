import { money } from '@/lib/format';

/**
 * Hand-rolled SVG charts — the money module needs three simple shapes and none
 * of them justify a charting dependency in a React 19 / Next 16 app. All are
 * pure (no client hooks) so they render in server components, and theme-aware
 * through CSS variables.
 */

type Point = { date: string; balance: string };

/** A small inline trend line for a metric card. */
export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;
  const w = 100;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * (h - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const rising = points[points.length - 1] >= points[0];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height: h }}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={rising ? 'var(--success)' : 'var(--muted-foreground)'}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** The cash-flow area chart. Line, gradient fill, faint grid, labelled endpoint. */
export function CashAreaChart({ series }: { series: Point[] }) {
  if (series.length < 2) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        Not enough history yet.
      </div>
    );
  }
  const w = 800;
  const h = 220;
  const padB = 22;
  const padT = 12;
  const values = series.map((p) => Number(p.balance));
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => (i / (series.length - 1)) * w;
  const y = (v: number) => padT + (1 - (v - min) / span) * (h - padT - padB);

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h - padB} L0,${h - padB} Z`;

  // Month boundaries for x-axis ticks.
  const ticks: Array<{ i: number; label: string }> = [];
  let lastMonth = '';
  series.forEach((p, i) => {
    const m = p.date.slice(0, 7);
    if (m !== lastMonth) {
      ticks.push({
        i,
        label: new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
      });
      lastMonth = m;
    }
  });

  const gridLines = [0, 0.5, 1].map((f) => min + f * span);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Cash balance over time">
      <defs>
        <linearGradient id="cashfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines.map((v, i) => (
        <line
          key={i}
          x1={0}
          x2={w}
          y1={y(v)}
          y2={y(v)}
          stroke="var(--border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={area} fill="url(#cashfill)" />
      <path d={line} fill="none" stroke="var(--foreground)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
      <circle cx={x(series.length - 1)} cy={y(values[values.length - 1])} r={3} fill="var(--foreground)" />
      {ticks.map((t) => (
        <text
          key={t.i}
          x={x(t.i)}
          y={h - 6}
          fontSize={11}
          fill="var(--muted-foreground)"
          textAnchor={t.i === 0 ? 'start' : 'middle'}
        >
          {t.label}
        </text>
      ))}
    </svg>
  );
}

/** Revenue split into its cost segments plus the profit that's left. */
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
      : `color-mix(in oklch, var(--foreground) ${70 - i * 14}%, var(--card))`;

  return (
    <div className="space-y-2.5">
      <div className="flex h-8 w-full overflow-hidden rounded-md border border-border">
        {segments.map((s, i) => {
          const pct = (Math.abs(s.value) / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={s.label}
              title={`${s.label}: ${money(s.value)}`}
              style={{ width: `${pct}%`, background: fill(s, i) }}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: fill(s, i) }}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="tabular-nums">{money(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
