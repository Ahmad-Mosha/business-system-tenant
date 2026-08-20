import { PageBody, PageHeader } from '@/components/page-header';
import { ShipmentsView } from '@/components/shipments-view';
import { Stat, StatCell, StatGrid } from '@/components/stat';
import { getBostaShipments, getOrderSummary } from '@/lib/api';
import { requireSession } from '@/lib/session';

export default async function ShipmentsPage() {
  await requireSession();

  const [shipments, summary] = await Promise.all([
    getBostaShipments().catch(() => []),
    getOrderSummary().catch(() => ({ total: 0, unassigned: 0, needsWork: 0, deliveredUnpaid: 0 })),
  ]);

  const deliveredCount = shipments.filter((s) => s.status === 'DELIVERED').length;
  const inTransitCount = shipments.filter((s) => s.status !== 'DELIVERED' && !s.isDelayed).length;
  const delayedCount = shipments.filter((s) => s.isDelayed).length;

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
              label="Delivered unpaid"
              value={String(summary.deliveredUnpaid)}
              hint="cash not yet collected"
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
