import { useTranslations } from 'next-intl';
import { ToneBadge } from '@/components/tone-badge';
import type { PaidStatus } from '@/lib/api';
import { PAID_STATUS } from '@/lib/money';

/** The paid state of a purchase invoice. */
export function PaidChip({ status, className }: { status: PaidStatus; className?: string }) {
  const t = useTranslations('enums.paidStatus');
  const known = status in PAID_STATUS ? status : 'UNPAID';
  return (
    <ToneBadge tone={PAID_STATUS[known].tone} className={className}>
      {t(known)}
    </ToneBadge>
  );
}
