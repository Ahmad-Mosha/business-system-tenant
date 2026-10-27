'use client';

import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { useDirection } from '@/components/ui/direction';
import { canonicalNumber, caretAfterClean, cleanNumber, groupNumber, stepNumber } from '@/lib/number-input';
import { cn } from '@/lib/utils';

type Props = Omit<ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'name' | 'min'> & {
  /** Controlled value (a plain number string). Leave unset with `defaultValue` for a form-only field. */
  value?: string;
  defaultValue?: string;
  /** Receives the canonical value — `12.` reports `12`, empty while nothing is typed. */
  onValueChange?: (value: string) => void;
  /** Submits the canonical value under this name, never the grouped text. */
  name?: string;
  /** Digits after the point; 0 for whole numbers (arrow keys then step by one). */
  decimals?: number;
  negative?: boolean;
  /** Thousands separators while typing — for amounts, not quantities. */
  group?: boolean;
  min?: number;
  /** Shown inside the field's end, e.g. the currency. */
  suffix?: ReactNode;
};

/**
 * The one field for typing a number. Left-to-right even on an Arabic page, so
 * a trailing point or minus never jumps to the far side; Arabic digits are
 * accepted; nothing is clamped or reformatted under the caret, and when
 * characters are dropped (a group comma, a stray letter) the caret stays where
 * the person was typing. Validation is the form's job — this never silently
 * changes the number someone entered.
 */
export function NumberField({
  value,
  defaultValue,
  onValueChange,
  name,
  decimals = 2,
  negative,
  group,
  min,
  suffix,
  className,
  onBlur,
  onKeyDown,
  onFocus,
  onMouseUp,
  ...props
}: Props) {
  const rules = { decimals, negative };
  // A value the system supplies is shown in full — the decimal limit governs
  // typing only, so nothing stored is ever blanked — but without padding:
  // `20000.00` reads `20,000`, `120.5000` reads `120.50`.
  const fromProp = (v: string | undefined) => tidyStored(cleanNumber(v ?? '', { ...rules, decimals: Number.MAX_SAFE_INTEGER }) ?? '');
  const [text, setText] = useState(() => fromProp(value ?? defaultValue));
  const [seen, setSeen] = useState(value);
  const [, rerender] = useState(0);
  const caret = useRef<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  // Set between focusing and the mouse-up that would otherwise drop the selection.
  const selecting = useRef(false);
  const rtl = useDirection() === 'rtl';

  // A parent changing the number (a recalculated total) wins over the text,
  // unless it is only the canonical form of what is being typed (`12.` vs `12`).
  if (value !== seen) {
    setSeen(value);
    if (value !== undefined && canonicalNumber(text) !== canonicalNumber(fromProp(value))) {
      setText(fromProp(value));
    }
  }

  const shown = group ? groupNumber(text) : text;

  useLayoutEffect(() => {
    if (caret.current !== null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
    }
    caret.current = null;
  });

  const commit = (next: string, at: number | null) => {
    caret.current = at;
    setText(next);
    if (canonicalNumber(next) !== canonicalNumber(text)) onValueChange?.(canonicalNumber(next));
  };

  const input: ComponentProps<'input'> = {
    ...props,
    ref,
    type: 'text',
    dir: 'ltr',
    inputMode: decimals ? 'decimal' : 'numeric',
    autoComplete: 'off',
    spellCheck: false,
    value: shown,
    className: cn('num', rtl ? 'text-left' : 'text-right', className),
    onChange: (e) => {
      const raw = e.currentTarget.value;
      const at = e.currentTarget.selectionStart ?? raw.length;
      const next = cleanNumber(raw, rules);
      if (next === null) {
        // Refused: React puts the old text back; keep the caret where it was.
        caret.current = Math.max(0, at - (raw.length - shown.length));
        rerender((n) => n + 1);
        return;
      }
      const kept = caretAfterClean(raw, at, rules);
      const display = group ? groupNumber(next) : next;
      let pos = 0;
      for (let count = 0; pos < display.length && count < kept; pos++) if (display[pos] !== ',') count++;
      commit(next, pos);
    },
    // Coming into the field selects the whole number, so typing replaces it —
    // no aiming the caret behind a `1` to change a quantity.
    onFocus: (e) => {
      selecting.current = true;
      e.currentTarget.select();
      onFocus?.(e);
    },
    onMouseUp: (e) => {
      if (selecting.current) e.preventDefault();
      selecting.current = false;
      onMouseUp?.(e);
    },
    onBlur: (e) => {
      selecting.current = false;
      const tidy = canonicalNumber(text);
      if (tidy !== text) setText(tidy);
      onBlur?.(e);
    },
    onKeyDown: (e) => {
      if (!decimals && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const next = stepNumber(canonicalNumber(text), e.key === 'ArrowUp' ? 1 : -1, min);
        commit(next, (group ? groupNumber(next) : next).length);
      }
      onKeyDown?.(e);
    },
  };

  return (
    <>
      {suffix !== undefined ? (
        <InputGroup>
          <InputGroupInput {...input} />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{suffix}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      ) : (
        <Input {...input} />
      )}
      {name ? <input type="hidden" name={name} value={canonicalNumber(text)} /> : null}
    </>
  );
}

/** A stored figure without its padding: an all-zero fraction goes, others keep at least two places. */
function tidyStored(n: string): string {
  const [whole, frac] = n.split('.');
  if (frac === undefined || /^0*$/.test(frac)) return whole;
  const trimmed = frac.replace(/0+$/, '');
  return `${whole}.${trimmed.length < 2 ? trimmed.padEnd(2, '0') : trimmed}`;
}
