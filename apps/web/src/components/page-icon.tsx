'use client';

import { usePathname } from 'next/navigation';
import { locate } from '@/lib/nav';

/** The screen's own sidebar icon, as a tile beside its title — the same mark in both places. */
export function PageIcon() {
  const Icon = locate(usePathname())?.item.icon;
  if (!Icon) return null;
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-b from-primary/16 to-primary/6 text-highlight shadow-xs ring-1 ring-primary/18 [&_svg]:size-4"
    >
      <Icon />
    </span>
  );
}
