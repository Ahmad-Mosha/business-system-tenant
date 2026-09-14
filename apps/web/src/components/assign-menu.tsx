'use client';

import { UserRound } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { assignOrder } from '@/app/(app)/orders/actions';
import { InlineMenu } from '@/components/inline-menu';
import { cn } from '@/lib/utils';

interface Assignee {
  id: string;
  name: string;
}

const NOBODY = 'unassigned';

/**
 * Assigns an order to a moderator straight from the list. It renders whatever
 * `assignees` the page passes, so a moderator added tomorrow shows up here
 * with no code change.
 */
export function AssignMenu({
  orderId,
  assignedToId,
  assignedToName,
  assignees,
}: {
  orderId: string;
  assignedToId: string | null;
  assignedToName: string | null;
  assignees: Assignee[];
}) {
  const [pending, start] = useTransition();

  return (
    <InlineMenu
      label={`Change assignee, currently ${assignedToName ?? 'unassigned'}`}
      pending={pending}
      className="-ms-1.5 px-1.5 py-1 hover:bg-muted"
      trigger={
        <>
          <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
          <span className={cn('truncate', !assignedToName && 'text-muted-foreground')}>
            {assignedToName ?? 'Unassigned'}
          </span>
        </>
      }
      sections={[
        {
          heading: 'Assign to',
          items: [
            { value: NOBODY, label: 'Unassigned', current: !assignedToId },
            ...assignees.map((a) => ({ value: a.id, label: a.name, current: a.id === assignedToId })),
          ],
        },
      ]}
      onSelect={(value) => {
        const to = value === NOBODY ? null : value;
        if (to === assignedToId) return;
        start(async () => {
          const result = await assignOrder(orderId, to);
          if (!result.ok) toast.error(result.message);
          else toast.success(to ? `Assigned to ${assignees.find((a) => a.id === to)?.name}.` : 'Unassigned.');
        });
      }}
    />
  );
}
