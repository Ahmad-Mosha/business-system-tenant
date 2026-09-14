import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A screen, under the site header. It scrolls as one page by default.
 *
 * `fill` pins it to the viewport from `lg` up, so a TablePanel inside takes the
 * remaining height and scrolls on its own — the filters above and the
 * pagination below never leave the screen. Under `lg` it scrolls as a page
 * regardless: a table squeezed between stacked cards is worse than a long page.
 */
export function Page({
  children,
  fill = false,
  width = 'wide',
}: {
  children: ReactNode;
  fill?: boolean;
  /** `narrow` for single-column forms and documents. */
  width?: 'wide' | 'narrow';
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', fill && 'lg:overflow-hidden')}>
      <div
        className={cn(
          'mx-auto flex w-full flex-1 flex-col gap-6 p-4 md:px-6 md:py-6',
          width === 'wide' ? 'max-w-[1600px]' : 'max-w-3xl',
          fill && 'lg:min-h-0',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The one title treatment — every screen opens the same way, so the eye lands
 * in the same place on every navigation. `back` adds a visible way out (detail
 * and form screens); `meta` sits beside the title (status badges).
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 items-start gap-3">
        {back ? (
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={back.href} aria-label={back.label} title={back.label}>
              <ArrowLeft className="rtl:rotate-180" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0">
          <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 text-2xl leading-8 font-semibold tracking-tight">{title}</h1>
            {meta}
          </div>
          {description ? (
            <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
