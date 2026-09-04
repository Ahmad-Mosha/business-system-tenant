'use client';

import { ChevronDown, Loader2, User } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { assignOrder } from '@/app/(app)/orders/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Assignee {
  id: string;
  name: string;
}

/**
 * Assigns an order to a moderator straight from the list — admin never has
 * to open each order just to hand it off. Grows with the team on its own:
 * it renders whatever `assignees` the page passes, so a moderator added
 * tomorrow shows up here with no code change.
 *
 * Same row-is-a-link caveat as the other list menus: everything here stops
 * propagation so picking a name doesn't also navigate to the order.
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
  const [open, setOpen] = useState(false);

  const move = (to: string | null) =>
    start(async () => {
      const result = await assignOrder(orderId, to);
      if (result.ok) {
        const name = to ? (assignees.find((a) => a.id === to)?.name ?? 'moderator') : null;
        toast.success(name ? `Assigned to ${name}.` : 'Unassigned.');
      } else toast.error(result.message);
    });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={`Change assignee, currently ${assignedToName ?? 'unassigned'}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={cn(
            'relative z-10 -ms-1.5 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            pending ? 'opacity-60' : 'hover:bg-accent',
          )}
        >
          <User className="size-3 shrink-0 text-muted-foreground/60" />
          <span className={cn('truncate', !assignedToName && 'text-muted-foreground/50')}>
            {assignedToName ?? 'Unassigned'}
          </span>
          {pending ? (
            <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground/60" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-48" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
          Assign to
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setOpen(false);
            move(null);
          }}
          className={cn('text-sm', !assignedToId && 'font-medium')}
        >
          Unassigned
        </DropdownMenuItem>
        {assignees.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onSelect={(e) => {
              e.preventDefault();
              setOpen(false);
              move(a.id);
            }}
            className={cn('text-sm', assignedToId === a.id && 'font-medium')}
          >
            {a.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
