import { AlertTriangle } from 'lucide-react';
import { Amount } from '@/components/amount';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { ShipmentsView } from '@/components/shipments-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getBostaShipments } from '@/lib/api';
import { requireSession } from '@/lib/session';

export default async function ShipmentsPage() {
  await requireSession();

  // A failed fetch must not read as "zero shipments" — the two look identical
  // to a user with nothing to say anything went wrong.
  let shipments: Awaited<ReturnType<typeof getBostaShipments>> = [];
  let loadError: string | null = null;
  try {
    shipments = await getBostaShipments();
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Could not reach Bosta.';
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
      <PageHeader title="Shipments" description="Every live Bosta delivery, in one place." />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Could not load shipments from Bosta</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <MetricGrid>
        <MetricCard label="Live shipments" value={shipments.length} hint="Active Bosta deliveries" />
        <MetricCard
          label="Delivered"
          value={delivered}
          hint={
            shipments.length
              ? `${Math.round((delivered / shipments.length) * 100)}% of live shipments`
              : 'Nothing delivered yet'
          }
        />
        <MetricCard
          label="In transit"
          value={inTransit}
          tone={delayed > 0 ? 'warning' : 'default'}
          hint={delayed > 0 ? `${delayed} delayed` : 'With the courier or out for delivery'}
        />
        <MetricCard
          label="COD to collect"
          value={<Amount value={uncollectedValue} />}
          tone={uncollected.length > 0 ? 'warning' : 'default'}
          hint={
            uncollected.length > 0
              ? `${uncollected.length} delivered, cash not remitted`
              : 'Bosta holds nothing of ours'
          }
        />
      </MetricGrid>

      <ShipmentsView initialShipments={shipments} />
    </Page>
  );
}
