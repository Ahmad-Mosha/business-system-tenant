import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * A bordered region. Sections are separated by weight and a single rule, not
 * by nesting boxes inside boxes.
 */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-[4px] border border-line bg-surface', className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex h-11 items-center justify-between gap-3 border-b border-line px-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {meta && <span className="text-xs text-ink-faint">{meta}</span>}
      </div>
      {action}
    </header>
  );
}
