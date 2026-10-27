'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ProblemNotice } from '@/components/forms/problem-notice';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import type { Problem } from '@/lib/problem';

type Result = { ok: true } | { ok: false; message: string; problem?: Problem } | void;

/**
 * An action that changes a record's life — archive, restore, delete — asked
 * once, in plain words, with the button saying exactly what will happen.
 *
 * When the screen already knows the action is blocked (`blocked`), the dialog
 * explains what's in the way and how to clear it instead of offering the
 * button — the button is never just greyed out. A refusal at submit (the
 * record changed meanwhile) shows the same way, with the API's fresh reasons.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  success,
  destructive = false,
  action,
  blocked,
  blockedTitle,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  success?: string;
  destructive?: boolean;
  /** A server action; when it redirects, the page simply moves on. */
  action: () => Promise<Result>;
  /** Why it can't be done right now, from the screen's own data. */
  blocked?: Problem | null;
  /** The dialog's title while blocked — "This product can't be archived yet". */
  blockedTitle?: ReactNode;
}) {
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [refusal, setRefusal] = useState<{ message: string; problem?: Problem } | null>(null);
  const shown = refusal ?? (blocked ? { message: '', problem: blocked } : null);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setRefusal(null);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{blocked && blockedTitle ? blockedTitle : title}</AlertDialogTitle>
          {blocked ? null : <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {shown ? <ProblemNotice problem={shown.problem} message={shown.message} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{blocked ? tc('close') : tc('cancel')}</AlertDialogCancel>
          {blocked ? null : (
            <AlertDialogAction
              variant={destructive ? 'destructive' : 'default'}
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                start(async () => {
                  setRefusal(null);
                  const r = await action();
                  if (r && !r.ok) return void setRefusal({ message: r.message, problem: r.problem });
                  if (success) toast.success(success);
                  setOpen(false);
                });
              }}
            >
              {pending ? <Spinner /> : null}
              {confirmLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
