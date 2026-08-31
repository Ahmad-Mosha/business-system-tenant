import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'accent';

const TONES: Record<Tone, string> = {
  neutral: 'text-ink-soft bg-raised border-line-strong',
  good: 'text-good bg-good-soft border-good/30',
  warn: 'text-warn bg-warn-soft border-warn/30',
  bad: 'text-bad bg-bad-soft border-bad/30',
  accent: 'text-accent bg-accent-soft border-accent/30',
};

/**
 * State, never identity. A chip says what happened to a thing — delivered,
 * unpaid, unmapped — not what kind of thing it is.
 */
export function Status({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 self-start rounded-full border px-1.5 py-px',
        'label-caps !text-[10px] leading-4',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
