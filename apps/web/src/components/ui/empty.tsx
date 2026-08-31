import type { ReactNode } from 'react';

/**
 * Empty means "nothing here yet and here is what to do", never a blank area.
 * It states the real reason — no seeded data, no import run — rather than a
 * decorative shrug.
 */
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 px-3 py-8">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      <p className="max-w-prose text-xs text-ink-soft">{detail}</p>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
