import { ContextBar, Screen, Scroller } from '@/components/shell';
import { ModeratorForm } from '@/components/moderator-form';
import type { TeamMember } from '@/lib/api';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';

export function TeamScreen({ team }: { team: TeamMember[] }) {
  return (
    <Screen>
      <ContextBar
        title="Team"
        meta="moderators, and how the orders assigned to them are going"
        actions={<ModeratorForm />}
      />

      <Scroller className="p-4">
        {team.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No moderators yet. Add one so orders can be assigned.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {team.map((m) => (
              <ModeratorCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </Scroller>
    </Screen>
  );
}

function ModeratorCard({ m }: { m: TeamMember }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold uppercase">
          {m.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{m.name}</p>
          <p className="truncate text-[12px] text-muted-foreground">{m.email}</p>
        </div>
        {!m.active && (
          <span className="ms-auto shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            Inactive
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
        <Kpi label="Orders assigned" value={m.assigned} />
        <Kpi label="Delivery rate" value={m.deliveryRate === null ? '—' : `${m.deliveryRate}%`} />
        <Kpi label="Delivered" value={m.delivered} tone="success" />
        <Kpi
          label="Cancelled"
          value={m.cancelled}
          tone={m.cancelled > 0 ? 'destructive' : 'default'}
        />
        <div className="col-span-2">
          <Kpi label="Delivered sales value" value={money(m.deliveredValue)} />
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'destructive';
}) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-[15px] font-semibold tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </p>
    </div>
  );
}
