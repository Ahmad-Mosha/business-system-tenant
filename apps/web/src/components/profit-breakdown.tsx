import { useTranslations } from 'next-intl';
import { Amount } from '@/components/amount';
import { ProfitChart, type Bucket } from '@/components/charts';
import type { BusinessProfitReport } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * The owners' operating measure for manual/social and Easy Orders. This is
 * deliberately named business profit: the accounting revenue and expense
 * accounts remain visible elsewhere on the page as a separate view. The three
 * figures read as a sum — selling amount, minus shipping, equals profit — beside
 * the chart of it over time.
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
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <dl className="grid content-start gap-4 text-[13px]">
        <div>
          <dt className="text-muted-foreground">{t('sellingAmount')}</dt>
          <dd className="mt-1 text-lg font-semibold">
            <Amount value={sales} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('orderShipping')}</dt>
          <dd className="mt-1 text-lg font-semibold">
            <Amount value={-shipping} />
          </dd>
        </div>
        <div className="border-t pt-4">
          <dt className="font-medium">{t('businessProfit')}</dt>
          <dd className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">
            <Amount value={profit} className={cn(profit < 0 && 'text-destructive')} />
          </dd>
        </div>
        {report.unreconciledEntries > 0 ? (
          <p className="border-s-2 border-warning ps-3 text-xs text-muted-foreground">
            {t('legacyProfitMissing', { count: report.unreconciledEntries })}
          </p>
        ) : null}
      </dl>
      <ProfitChart series={report.series} bucket={bucket} />
    </div>
  );
}
