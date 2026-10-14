'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ProblemNotice } from '@/components/problem-notice';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Problem } from '@/lib/problem';

/**
 * The button for an action that can't be taken right now: it still opens, and
 * says why — every record in the way, linked — and how to clear it. Never a
 * greyed-out button that leaves a person guessing.
 */
export function BlockedDialog({ trigger, title, problem }: { trigger: ReactNode; title: ReactNode; problem: Problem }) {
  const t = useTranslations('common');
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <ProblemNotice problem={problem} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {t('close')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
