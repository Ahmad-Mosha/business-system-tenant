import { cn } from '@/lib/cn';
import type { InputHTMLAttributes, ReactNode } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-(--spacing-control) w-full rounded-[3px] border border-line bg-surface px-2.5',
        'text-sm text-ink placeholder:text-ink-faint',
        'focus:border-accent focus-visible:outline-accent',
        'disabled:bg-raised disabled:text-ink-faint',
        'aria-[invalid=true]:border-bad',
        className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label-caps">{label}</label>
      {children}
      {/* One slot for both, so a field never grows taller when it errors. */}
      {(error || hint) && (
        <p className={cn('text-xs', error ? 'text-bad' : 'text-ink-faint')}>{error ?? hint}</p>
      )}
    </div>
  );
}
