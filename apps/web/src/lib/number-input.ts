/**
 * What a number field accepts while someone types. Pure, so the rules are
 * tested without a browser (number-input.test.ts); `NumberField` is the only
 * caller.
 */
export interface NumberRules {
  /** Digits allowed after the decimal point; 0 makes the field whole-number only. */
  decimals: number;
  negative?: boolean;
}

// Arabic-Indic (٠-٩) and Eastern Arabic/Persian (۰-۹) digits read as 0-9.
const DIGITS: Record<string, string> = {};
for (let i = 0; i < 10; i++) {
  DIGITS[String.fromCharCode(0x0660 + i)] = String(i);
  DIGITS[String.fromCharCode(0x06f0 + i)] = String(i);
}

/**
 * Cleans one keystroke's worth of input. Arabic digits and the Arabic decimal
 * mark (٫) become Western; group separators and anything else are dropped.
 * Returns null when the result breaks a rule (a second decimal point, too many
 * decimals), so the field keeps what it had instead of silently rewriting it.
 */
export function cleanNumber(raw: string, rules: NumberRules): string | null {
  let out = '';
  for (const ch of raw) {
    const c = DIGITS[ch] ?? (ch === '٫' ? '.' : ch);
    if (c >= '0' && c <= '9') out += c;
    else if (c === '.') {
      if (rules.decimals === 0 || out.includes('.')) return null;
      out += '.';
    } else if ((c === '-' || c === '−') && rules.negative && out === '') out = '-';
  }
  // A leading zero gives way to the digit typed after it: `0` then `5` is `5`, never `05`.
  out = out.replace(/^(-?)0+(?=\d)/, '$1');
  const dot = out.indexOf('.');
  if (dot !== -1 && out.length - dot - 1 > rules.decimals) return null;
  return out;
}

/** The same cleaning applied to the text left of the caret, so the caret stays after the character it followed. */
export function caretAfterClean(raw: string, caret: number, rules: NumberRules): number {
  return (cleanNumber(raw.slice(0, caret), { ...rules, decimals: Number.MAX_SAFE_INTEGER }) ?? '').length;
}

/**
 * The value a form or the API receives: no trailing point, no padding zeros,
 * empty while nothing meaningful is typed. `12.` → `12`, `007` → `7`, `-` → ``.
 */
export function canonicalNumber(text: string): string {
  if (text === '' || text === '-' || text === '.' || text === '-.') return '';
  let t = text.endsWith('.') ? text.slice(0, -1) : text;
  const negative = t.startsWith('-');
  if (negative) t = t.slice(1);
  if (t.startsWith('.')) t = `0${t}`;
  t = t.replace(/^0+(?=\d)/, '');
  return negative && Number(t) !== 0 ? `-${t}` : t;
}

/** `1250000.5` → `1,250,000.5` for reading once the field is left. */
export function groupNumber(canonical: string): string {
  const [whole, frac] = canonical.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/** Arrow-key stepping for whole-number fields; never below `min`. */
export function stepNumber(canonical: string, by: number, min?: number): string {
  const next = (Number(canonical) || 0) + by;
  return String(min !== undefined ? Math.max(min, next) : next);
}
