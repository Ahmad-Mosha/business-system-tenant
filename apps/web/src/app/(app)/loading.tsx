import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The shape of a screen while it loads — title, figures, filters, table — drawn
 * with the same padding, frames and radii as `Page`, `MetricGrid` and
 * `TablePanel`, so the real screen lands exactly where its outline was.
 */
export default function Loading() {
  const t = useTranslations('common');
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-busy aria-label={t('loading')}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:px-8 md:py-7">
        <div className="grid gap-2.5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/8 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid gap-2.5 border-s px-5 py-4 first:border-s-0">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/8">
          <div className="h-10 border-b bg-muted/40" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b px-5 py-3.5 last:border-b-0">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
