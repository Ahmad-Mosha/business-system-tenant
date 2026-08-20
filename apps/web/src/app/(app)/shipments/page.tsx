import { PageBody, PageHeader } from '@/components/page-header';
import { ShipmentsView } from '@/components/shipments-view';
import { Stat, StatCell, StatGrid } from '@/components/stat';
import { getBostaShipments } from '@/lib/api';
import { money } from '@/lib/format';
import { requireSession } from '@/lib/session';

export default async function ShipmentsPage() {
  await requireSession();

  const shipments = await getBostaShipments().catch(() => []);

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

        {/* Live Shipments View */}
        <section>
          <ShipmentsView initialShipments={shipments} />
        </section>
      </PageBody>
    </>
  );
}
