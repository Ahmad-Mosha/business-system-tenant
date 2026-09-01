'use client';

import { useState } from 'react';
import { groupDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * An amount field that shows thousands separators as you type — so entering
 * `1250000` reads back as `1,250,000` and you can see the decimal point coming
 * instead of counting zeros. The form still receives the plain number.
 */
export function MoneyInput({
  name,
  defaultValue = '',
  placeholder = '0.00',
  required,
  autoFocus,
  disabled,
  className,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(() =>
    defaultValue ? groupDigits(defaultValue) : '',
  );
  const raw = display.replace(/,/g, '');

  return (
    <span className="relative block">
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => setDisplay(groupDigits(e.target.value))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="Amount in EGP"
        className={cn(
          'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-right text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          className,
        )}
      />
      {/* The unformatted value the server action reads. */}
      <input type="hidden" name={name} value={raw} required={required} />
    </span>
  );
}
