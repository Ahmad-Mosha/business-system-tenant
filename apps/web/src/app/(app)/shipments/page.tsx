import { AlertTriangle } from 'lucide-react';
import { ShipmentsView } from '@/components/shipments-view';
import { MetricCard, MetricRow, PageCard, Screen, Scroller } from '@/components/shell';
import { getBostaShipments } from '@/lib/api';
import { money } from '@/lib/format';
import { requireSession } from '@/lib/session';

export default async function ShipmentsPage() {
  await requireSession();

  // A failed fetch must not read as "zero shipments" — those look identical
  // to a user with nothing to indicate anything went wrong. The error is
  // captured and shown instead of silently defaulting to an empty list.
  let shipments: Awaited<ReturnType<typeof getBostaShipments>> = [];
  let loadError: string | null = null;
  try {
    shipments = await getBostaShipments();
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Could not reach Bosta.';
  }

  const deliveredCount = shipments.filter((s) => s.status === 'DELIVERED').length;
  const inTransitCount = shipments.filter((s) => s.status !== 'DELIVERED' && !s.isDelayed).length;

  // What the courier is holding: delivered to the customer, cash not yet
  // remitted to us. Read from Bosta, not from our order status — the courier
  // is the authority on whether the money has been collected.
  const uncollected = shipments.filter(
    (s) => s.status === 'DELIVERED' && s.cod?.collectionStatus !== 'PAID',
  );
  const uncollectedValue = uncollected.reduce((n, s) => n + (s.cod?.amount ?? 0), 0);

  return (
    <Screen>
      <Scroller className="p-4">
        <div className="space-y-4">
          <PageCard title="Shipments" description="Every live Bosta delivery, in one place." />

          {loadError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive-subtle px-4 py-3 text-[13px] text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <div>
                <p className="font-medium">Could not load shipments from Bosta.</p>
                <p className="mt-0.5 text-destructive/80">{loadError}</p>
              </div>
            </div>
          )}

          <MetricRow>
            <MetricCard
              label="Live shipments"
              value={shipments.length}
              hint="active Bosta deliveries"
            />
            <MetricCard label="Delivered" value={deliveredCount} hint="successfully received" />
            <MetricCard
              label="In transit"
              value={inTransitCount}
              hint="with courier / out for delivery"
            />
            <MetricCard
              label="COD to collect"
              value={money(uncollectedValue)}
              tone={uncollected.length > 0 ? 'warning' : 'default'}
              hint={`${uncollected.length} delivered, cash not remitted`}
            />
          </MetricRow>

          <ShipmentsView initialShipments={shipments} />
        </div>
      </Scroller>
    </Screen>
  );
}
