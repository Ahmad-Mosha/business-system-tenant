import type { PaidStatus } from '@/lib/api';
import { PAID_STATUS } from '@/lib/money';
import { cn } from '@/lib/utils';

/** The paid state of a purchase invoice, as a bordered chip. */
export function PaidChip({ status, className }: { status: PaidStatus; className?: string }) {
  const s = PAID_STATUS[status] ?? PAID_STATUS.UNPAID;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase',
        s.tone === 'ok' && 'border-success/40 text-success',
        s.tone === 'warn' && 'border-warning/40 text-warning',
        s.tone === 'muted' && 'border-border text-muted-foreground',
        className,
      )}
    >
      {s.label}
    </span>
  );
}
