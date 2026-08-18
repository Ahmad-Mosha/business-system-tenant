import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface', className)}>
      {children}
    </section>
  );
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {action}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}
