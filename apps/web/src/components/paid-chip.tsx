import { ToneBadge } from '@/components/tone-badge';
import type { PaidStatus } from '@/lib/api';
import { PAID_STATUS } from '@/lib/money';

/** The paid state of a purchase invoice. */
export function PaidChip({ status, className }: { status: PaidStatus; className?: string }) {
  const s = PAID_STATUS[status] ?? PAID_STATUS.UNPAID;
  return (
    <ToneBadge tone={s.tone} className={className}>
      {s.label}
    </ToneBadge>
  );
}
