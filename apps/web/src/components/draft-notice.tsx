'use client';

import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/i18n/use-format';

/**
 * Says that the form holds restored, unsaved work and offers to throw it away
 * (with undo), or — for a draft made before the record last changed — offers
 * to bring it back.
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
  const at = draft.restoredAt ?? draft.staleAt;
  if (at === null) return null;
  const when = f.dateTime(new Date(at).toISOString());

  const discard = () => {
    const previous = draft.discard();
    if (previous !== null) {
      toast(t('discarded'), { action: { label: t('undo'), onClick: () => onUndo(previous) } });
    }
  };

  return (
    <Alert className="mb-4">
      <History />
      <AlertDescription>{t(draft.staleAt !== null ? 'stale' : 'restored', { when })}</AlertDescription>
      <AlertAction className="flex gap-2">
        {draft.staleAt !== null ? (
          <Button size="sm" variant="outline" onClick={draft.restoreStale}>
            {t('restore')}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={discard}>
          {t('discard')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
