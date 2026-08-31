import { Page } from '@/components/page';
import { Empty } from '@/components/ui/empty';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Status } from '@/components/ui/status';
import { health } from '@/lib/api';

/**
 * The four figures the owner wants every day. They are blank because nothing
 * has been recorded yet — and they say so, rather than showing a zero that
 * looks like a measurement.
 */
const FIGURES = [
  { label: 'Cash', reason: 'No money events recorded yet' },
  { label: 'Stock value', reason: 'No stock recorded yet' },
  { label: 'Sales, 30 days', reason: 'No sales recorded yet' },
  { label: 'Gross profit', reason: 'Needs cost and sales' },
] as const;

function Figure({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5">
      <span className="label-caps">{label}</span>
      <span className="font-mono text-xl leading-7 text-ink-faint">—</span>
      <span className="text-xs text-ink-faint">{reason}</span>
    </div>
  );
}

export default async function OverviewPage() {
  const { status, database } = await health();
  const apiUp = status === 'ok';
  const dbUp = database === 'ok';

  return (
    <Page title="Overview">
      <div className="flex flex-col gap-4">
        <Panel className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {FIGURES.map((f) => (
            <Figure key={f.label} {...f} />
          ))}
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Needs attention" />
            <Empty
              title="Nothing waiting"
              detail="Import rows that match no product, orders stuck in a state, and shipments past their promised date all surface here."
            />
          </Panel>

          <Panel>
            <PanelHeader title="Connections" />
            <ul className="divide-y divide-line">
              <ConnectionRow name="API" detail="This interface talks to it for everything">
                {apiUp ? (
                  <Status tone="good">Reachable</Status>
                ) : (
                  <Status tone="bad">Unreachable</Status>
                )}
              </ConnectionRow>

              <ConnectionRow name="Database" detail="Postgres — every recorded event lives here">
                {dbUp ? <Status tone="good">Reachable</Status> : <Status tone="bad">Unreachable</Status>}
              </ConnectionRow>

              <ConnectionRow name="noon" detail="Settlement reports, uploaded as CSV">
                <Status tone="neutral">Not set up</Status>
              </ConnectionRow>

              <ConnectionRow name="Bosta" detail="Courier — shipment status and COD">
                <Status tone="neutral">Not set up</Status>
              </ConnectionRow>

              <ConnectionRow
                name="Easy Orders"
                detail="Website orders arrive by webhook — needs a public address"
              >
                <Status tone="neutral">Not set up</Status>
              </ConnectionRow>
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  );
}

function ConnectionRow({
  name,
  detail,
  children,
}: {
  name: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex h-(--spacing-row) items-center justify-between gap-3 px-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-[13px] font-medium text-ink">{name}</span>
        <span className="truncate text-xs text-ink-faint">{detail}</span>
      </div>
      {children}
    </li>
  );
}
