'use client';

import { History, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/i18n/use-format';
import { cn } from '@/lib/utils';

/**
 * Says, plainly and where it can't be missed, that the form holds restored
 * unsaved work — when it's from, that it lives only on this device — and
 * offers to carry on or throw it away (with undo). A draft made before the
 * record last changed is offered instead of applied, in amber, with Restore
 * as the main move.
 */
export function DraftNotice<T>({
  draft,
  onUndo,
}: {
  draft: {
    restoredAt: number | null;
    staleAt: number | null;
    restoreStale: () => void;
    discard: () => T | null;
  };
  /** Puts a discarded draft back. */
  onUndo: (value: T) => void;
}) {
  const t = useTranslations('drafts');
  const f = useFormat();
  // "Keep editing" only hides the notice; the draft itself stays.
  const [seen, setSeen] = useState<number | null>(null);
  const stale = draft.staleAt !== null;
  const at = draft.restoredAt ?? draft.staleAt;
  if (at === null || at === seen) return null;
  const when = f.dateTime(new Date(at).toISOString());

  const discard = () => {
    const previous = draft.discard();
    if (previous !== null) {
      toast(t('discarded'), { action: { label: t('undo'), onClick: () => onUndo(previous) } });
    }
  };

  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border px-4 py-3.5 sm:px-5',
        stale ? 'border-warning/35 bg-warning-subtle' : 'border-highlight/30 bg-highlight/8',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg',
          stale ? 'bg-warning/15 text-warning' : 'bg-highlight/15 text-highlight',
        )}
      >
        <History className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-sm font-semibold">{t(stale ? 'staleTitle' : 'restoredTitle')}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(stale ? 'staleDetail' : 'restoredDetail', { when })}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {stale ? (
          <Button size="sm" onClick={draft.restoreStale}>
            <RotateCcw />
            {t('restore')}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setSeen(at)}>
            {t('keepEditing')}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={discard} className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
          <Trash2 />
          {t('discard')}
        </Button>
      </div>
    </section>
  );
}
