import { moneyParts } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * A money figure: bold whole part, quiet piastres — `1,259,411.00` reads as
 * "one and a quarter million" at a glance instead of trailing zeros that look
 * like extra digits. `signed` prints a leading + for positive values.
 */
export function Amount({
  value,
  signed = false,
  className,
}: {
  value: string | number | null | undefined;
  signed?: boolean;
  className?: string;
}) {
  if (value === null || value === undefined || value === '') {
    return <span className={cn('num text-muted-foreground', className)}>—</span>;
  }
  const p = moneyParts(value);
  const sign = p.sign || (signed && Number(value) > 0 ? '+' : '');
  // Isolated left-to-right: in Arabic text an unisolated `−10,000.00` can
  // lose its minus to the far side of the number.
  return (
    <span dir="ltr" className={cn('num whitespace-nowrap', className)}>
      {sign}
      {p.whole}
      <span className="text-[0.62em] font-medium text-muted-foreground">{p.frac}</span>
    </span>
  );
}
