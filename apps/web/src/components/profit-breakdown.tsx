import { useTranslations } from 'next-intl';
import { Amount } from '@/components/amount';
import { ProfitChart, type Bucket } from '@/components/charts';
import type { PeriodSummary, ProfitPoint } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * The overview's profit section: revenue/COGS/margin for the period at a
 * glance, then the trend that produced them. Stays quiet (no chart, no
 * profit claimed) until COGS is actually posted — see the comment on the
 * Performance card lower on this page for why that's deliberate.
 */
export function ProfitSection({
  summary,
  series,
  bucket,
}: {
  summary: PeriodSummary;
  series: ProfitPoint[];
  bucket: Bucket;
}) {
  const t = useTranslations('money.overview');
  const revenue = Number(summary.revenue);
  const cogs = Number(summary.cogs);
  const grossProfit = Number(summary.grossProfit);
  const netProfit = Number(summary.netProfit);
  const grossMargin = revenue > 0.005 ? (grossProfit / revenue) * 100 : null;
  const netMargin = revenue > 0.005 ? (netProfit / revenue) * 100 : null;

  if (revenue <= 0.005) {
    return <p className="text-xs text-muted-foreground">{t('noCosts')}</p>;
  }
  if (cogs <= 0.005) {
    return <p className="text-xs text-muted-foreground">{t('noCogs')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 border-b pb-4 sm:grid-cols-4">
        <Stat label={t('salesRevenue')} value={<Amount value={revenue} />} />
        <Stat label={t('costOfGoods')} value={<Amount value={cogs} />} />
        <Stat
          label={t('grossProfit')}
          value={<Amount value={grossProfit} signed className={cn(grossProfit < 0 && 'text-destructive')} />}
          hint={grossMargin === null ? undefined : `${grossMargin.toFixed(1)}%`}
        />
        <Stat
          label={t('netProfit')}
          value={<Amount value={netProfit} signed className={cn(netProfit < 0 && 'text-destructive')} />}
          hint={netMargin === null ? undefined : `${netMargin.toFixed(1)}%`}
        />
      </div>
      <ProfitChart series={series} bucket={bucket} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex items-baseline gap-1.5">
        <span className="text-base font-semibold">{value}</span>
        {hint ? <span className="num text-xs text-muted-foreground">({hint})</span> : null}
      </p>
    </div>
  );
}
