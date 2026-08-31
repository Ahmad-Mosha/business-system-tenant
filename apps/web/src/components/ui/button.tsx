import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink/90 disabled:bg-ink/40',
  secondary: 'bg-surface text-ink border border-line hover:bg-raised disabled:text-ink-faint',
  ghost: 'text-ink-soft hover:bg-raised hover:text-ink',
  danger: 'bg-bad text-white hover:bg-bad/90',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Table row actions and toolbar controls, where 34px is still too tall. */
  compact?: boolean;
}

export function Button({ variant = 'secondary', compact, className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-[3px] font-medium whitespace-nowrap',
        'transition-colors disabled:cursor-not-allowed',
        compact ? 'h-7 px-2 text-xs' : 'h-(--spacing-control) px-3 text-sm',
        VARIANTS[variant],
        className,
      )}
    />
  );
}
