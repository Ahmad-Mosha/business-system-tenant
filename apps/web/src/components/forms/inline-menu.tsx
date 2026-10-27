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
 *
 * In a table the whole cell is the control: the trigger's hit area stretches
 * over its cell (the cell is positioned while it holds one), so a click beside
 * the value opens the menu instead of falling through to the row's link — and
 * the value lights up wherever the pointer is in that cell.
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
          data-slot="inline-menu"
          className={cn(
            'group/inline relative z-10 -mx-2 inline-flex max-w-[calc(100%+1rem)] cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 outline-none transition-colors',
            'hover:bg-muted data-[state=open]:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60',
            "[td_&]:static [td_&]:before:absolute [td_&]:before:inset-0 [td_&]:before:content-['']",
            className,
          )}
        >
          {trigger}
          {pending ? (
            <Spinner className="size-3 text-muted-foreground" />
          ) : (
            // In a table the chevrons show only on the hovered (or focused)
            // row — a column of them is noise. Elsewhere they always show.
            <ChevronDown className="size-3 shrink-0 text-muted-foreground/70 transition-[color,opacity] group-hover/inline:text-foreground group-data-[state=open]/inline:text-foreground group-data-[state=open]/inline:opacity-100 [tr_&]:opacity-0 [tr:focus-within_&]:opacity-100 [tr:hover_&]:opacity-100" />
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
