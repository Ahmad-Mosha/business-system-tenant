import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The time window a screen's figures and charts cover, chosen by link — the
 * page stays a server component, and the URL shares the exact view.
 */
export function PeriodTabs({
  value,
  options,
  href,
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  href: (value: string) => string;
}) {
  return (
    <nav aria-label="Period" className="inline-flex max-w-full overflow-x-auto border border-input">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Link
            key={o.value}
            href={href(o.value)}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'inline-flex h-8 shrink-0 items-center border-l border-input px-3 text-xs font-medium whitespace-nowrap transition-colors first:border-l-0',
              active ? 'bg-highlight/10 text-highlight' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
