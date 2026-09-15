import { AlertTriangle } from 'lucide-react';
import { Amount } from '@/components/amount';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { ShipmentsView } from '@/components/shipments-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getBostaShipments } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { getTranslations } from 'next-intl/server';

export default async function ShipmentsPage() {
  await requireSession();
  const t = await getTranslations('shipments');

  // A failed fetch must not read as "zero shipments" — the two look identical
  // to a user with nothing to say anything went wrong.
  let shipments: Awaited<ReturnType<typeof getBostaShipments>> = [];
  let loadError: string | null = null;
  try {
    shipments = await getBostaShipments();
  } catch (e) {
    loadError = e instanceof Error ? e.message : t('unreachable');
  }

  const delivered = shipments.filter((s) => s.status === 'DELIVERED').length;
  const inTransit = shipments.filter((s) => s.status !== 'DELIVERED' && !s.isDelayed).length;
  const delayed = shipments.filter((s) => s.isDelayed).length;

  // What the courier is holding: delivered to the customer, cash not yet
  // remitted to us. Read from Bosta — the courier is the authority on whether
  // the money has been collected, not our order status.
  const uncollected = shipments.filter(
    (s) => s.status === 'DELIVERED' && s.cod?.collectionStatus !== 'PAID',
  );
  const uncollectedValue = uncollected.reduce((n, s) => n + (s.cod?.amount ?? 0), 0);

  return (
    <Page fill>
      <PageHeader title={t('title')} description={t('description')} />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{t('loadFailed')}</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <MetricGrid>
        <MetricCard label={t('live')} value={shipments.length} hint={t('liveHint')} />
        <MetricCard
          label={t('delivered')}
          value={delivered}
          hint={
            shipments.length
              ? t('deliveredShare', { share: delivered / shipments.length })
              : t('deliveredNone')
          }
        />
        <MetricCard
          label={t('inTransit')}
          value={inTransit}
          tone={delayed > 0 ? 'warning' : 'default'}
          hint={delayed > 0 ? t('delayed', { count: delayed }) : t('inTransitHint')}
        />
        <MetricCard
          label={t('codToCollect')}
          value={<Amount value={uncollectedValue} />}
          tone={uncollected.length > 0 ? 'warning' : 'default'}
          hint={
            uncollected.length > 0
              ? t('codUncollected', { count: uncollected.length })
              : t('codNone')
          }
        />
      </MetricGrid>

      <ShipmentsView initialShipments={shipments} />
    </Page>
  );
}
