import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * What a state means, not what colour it is. `neutral` and `muted` are
 * waiting states, `progress` is moving (teal — ours or the courier's hands),
 * and the rest are outcomes.
 */
export type Tone = 'neutral' | 'muted' | 'progress' | 'success' | 'warning' | 'danger';

const VARIANT = {
  neutral: 'outline',
  muted: 'secondary',
  progress: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
} as const;

/** A state as a chip: tinted fill, hairline border, and a marker that carries it at a glance. */
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
    <Badge variant={VARIANT[tone]} className={cn('gap-1.5', className)}>
      <span aria-hidden className="size-1.5 shrink-0 bg-current opacity-80" />
      {children}
    </Badge>
  );
}
