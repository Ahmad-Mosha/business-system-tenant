import { AlertTriangle } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/page-header';
import { ShipmentTrackerView } from '@/components/shipment-tracker-view';
import { ShipmentsView } from '@/components/shipments-view';
import { Stat, StatCell, StatGrid } from '@/components/stat';
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
    <>
      <PageHeader
        title="Shipments"
        description="Live courier tracking, delivery states, and AWB lookups via Bosta"
      />

      <PageBody>
        {loadError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            <div>
              <p className="font-medium">Could not load shipments from Bosta.</p>
              <p className="mt-0.5 text-destructive/80">{loadError}</p>
            </div>
          </div>
        )}
        <StatGrid>
          <StatCell>
            <Stat
              label="Live shipments"
              value={String(shipments.length)}
              hint="active Bosta deliveries"
            />
          </StatCell>
          <StatCell>
            <Stat label="Delivered" value={String(deliveredCount)} hint="successfully received" />
          </StatCell>
          <StatCell>
            <Stat
              label="In transit"
              value={String(inTransitCount)}
              hint="with courier / out for delivery"
            />
          </StatCell>
          <StatCell>
            <Stat
              label="COD to collect"
              value={money(uncollectedValue)}
              hint={`${uncollected.length} delivered, cash not remitted`}
            />
          </StatCell>
        </StatGrid>

        <section>
          <ShipmentsView initialShipments={shipments} />
        </section>

        {/* Bosta has no "list my deliveries" endpoint — it only answers about a
            tracking number you already know. This is how a shipment that is not
            yet recorded against an order can still be looked up. */}
        <section>
          <ShipmentTrackerView />
        </section>
      </PageBody>
    </>
  );
}
