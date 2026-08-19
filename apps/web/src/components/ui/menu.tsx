'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuOption {
  key: string;
  label: string;
  description?: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  selected?: boolean;
  onSelect: () => void;
}

/**
 * Radix-backed menu. Rendered through a portal, which is the point: the previous
 * hand-rolled version was positioned `absolute` inside the table's
 * `overflow-x-auto` wrapper, and per the CSS spec a non-visible overflow on one
 * axis forces the other to clip too - so the menu was being cut off inside the
 * table. A portal escapes the clipping context entirely, and brings correct
 * collision handling, focus trapping and keyboard support with it.
 */
export function Menu({
  trigger,
  options,
  align = 'end',
  label,
}: {
  trigger: ReactNode;
  options: MenuOption[];
  align?: 'start' | 'end';
  label?: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-50 min-w-[16rem] overflow-hidden rounded-lg border border-line bg-surface p-1',
            'shadow-lg shadow-black/[0.08]',
          )}
        >
          {label ? (
            <DropdownMenu.Label className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              {label}
            </DropdownMenu.Label>
          ) : null}
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.key}
              disabled={option.disabled}
              onSelect={option.onSelect}
              className={cn(
                'flex cursor-pointer select-none items-start gap-2 rounded-md px-2.5 py-2 outline-none',
                'data-[highlighted]:bg-line-soft',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                option.tone === 'danger' ? 'text-bad' : 'text-ink',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium leading-tight">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">
                    {option.description}
                  </span>
                ) : null}
              </span>
              {option.selected ? (
                <Check className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
