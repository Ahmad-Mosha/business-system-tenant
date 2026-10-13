'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
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

type Result = { ok: true } | { ok: false; message: string } | void;

/**
 * An action that changes a record's life — archive, restore, delete — asked
 * once, in plain words, with the button saying exactly what will happen. The
 * dialog stays open on a refusal and shows the reason.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  success,
  destructive = false,
  action,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  success?: string;
  destructive?: boolean;
  /** A server action; when it redirects, the page simply moves on. */
  action: () => Promise<Result>;
}) {
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tc('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await action();
                if (r && !r.ok) return void toast.error(r.message);
                if (success) toast.success(success);
                setOpen(false);
              });
            }}
          >
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
