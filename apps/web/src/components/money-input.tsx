'use client';

import { useState } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { groupDigits } from '@/lib/format';

/**
 * An amount field that groups thousands as you type — `1250000` reads back as
 * `1,250,000`, so the decimal point is visible coming instead of counted in
 * zeros. The form still receives the plain number, under `name`.
 */
export function MoneyInput({
  name,
  id,
  defaultValue = '',
  placeholder = '0.00',
  autoFocus,
  disabled,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [display, setDisplay] = useState(() => (defaultValue ? groupDigits(defaultValue) : ''));

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => setDisplay(groupDigits(e.target.value))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className="num text-end"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>EGP</InputGroupText>
      </InputGroupAddon>
      {/* The unformatted value the server action reads. */}
      <input type="hidden" name={name} value={display.replace(/,/g, '')} />
    </InputGroup>
  );
}
