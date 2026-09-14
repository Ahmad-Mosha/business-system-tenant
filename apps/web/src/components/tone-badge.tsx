import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * What a state means, not what colour it is. `neutral` and `muted` are
 * waiting states, `progress` is moving (teal — ours or the courier's hands),
 * and the rest are outcomes.
 */
export type Tone = 'neutral' | 'muted' | 'progress' | 'success' | 'warning' | 'danger';

const DOT: Record<Tone, string> = {
  neutral: 'bg-muted-foreground/40',
  muted: 'bg-muted-foreground',
  progress: 'bg-highlight',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

/**
 * A state as a coloured mark and a plain word. No box around it: a column of
 * tinted chips turns a table into confetti, while a mark carries the state at
 * a glance and the word stays as readable as the rest of the row.
 */
export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0', DOT[tone])} />
      {children}
    </span>
  );
}
