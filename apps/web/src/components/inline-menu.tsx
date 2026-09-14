'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export interface InlineMenuSection {
  heading?: string;
  items: Array<{ value: string; label: ReactNode; destructive?: boolean; current?: boolean }>;
}

/**
 * A value you can change where it's shown — status, payment, assignee — right
 * from a list row. Rows are links (an overlay on the first cell), so the
 * trigger sits above it (`z-10`) and swallows its own click.
 */
export function InlineMenu({
  label,
  trigger,
  pending,
  sections,
  onSelect,
  className,
}: {
  /** Accessible name, e.g. "Change status, currently Confirmed". */
  label: string;
  trigger: ReactNode;
  pending?: boolean;
  sections: InlineMenuSection[];
  onSelect: (value: string) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={label}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={cn(
            'group/inline relative z-10 inline-flex max-w-full items-center gap-1 outline-none',
            'focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60',
            className,
          )}
        >
          {trigger}
          {pending ? (
            <Spinner className="size-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground/70 transition-colors group-hover/inline:text-foreground group-data-[state=open]/inline:text-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48" onClick={(e) => e.stopPropagation()}>
        {sections
          .filter((s) => s.items.length)
          .map((s, i) => (
            <Fragment key={s.heading ?? i}>
              {i > 0 ? <DropdownMenuSeparator /> : null}
              {s.heading ? <DropdownMenuLabel>{s.heading}</DropdownMenuLabel> : null}
              {s.items.map((item) => (
                <DropdownMenuItem
                  key={item.value}
                  variant={item.destructive ? 'destructive' : 'default'}
                  onSelect={() => onSelect(item.value)}
                >
                  {item.label}
                  {item.current ? <Check className="ms-auto" /> : null}
                </DropdownMenuItem>
              ))}
            </Fragment>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
