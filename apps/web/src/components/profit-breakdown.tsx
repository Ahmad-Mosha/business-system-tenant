import { useTranslations } from 'next-intl';
import { Amount } from '@/components/amount';
import { ProfitChart, type Bucket } from '@/components/charts';
import type { BusinessProfitReport } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * The owners' operating measure for manual/social and Easy Orders. This is
 * deliberately named business profit: the accounting revenue and expense
 * accounts remain visible elsewhere on the page as a separate view.
 */
export function ProfitSection({
  report,
  bucket,
}: {
  report: BusinessProfitReport;
  bucket: Bucket;
}) {
  const t = useTranslations('money.overview');
  const sales = Number(report.sales);
  const shipping = Number(report.shipping);
  const profit = Number(report.businessProfit);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 border-b pb-4 sm:grid-cols-3">
        <Stat label={t('sellingAmount')} value={<Amount value={sales} />} />
        <Stat label={t('orderShipping')} value={<Amount value={shipping} />} />
        <Stat
          label={t('businessProfit')}
          value={
            <Amount
              value={profit}
              signed
              className={cn(profit > 0 && 'text-success', profit < 0 && 'text-destructive')}
            />
          }
        />
      </div>
      {report.unreconciledEntries > 0 ? (
        <p className="border-s-2 border-warning ps-3 text-xs text-muted-foreground">
          {t('legacyProfitMissing', { count: report.unreconciledEntries })}
        </p>
      ) : null}
      <ProfitChart series={report.series} bucket={bucket} />
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
