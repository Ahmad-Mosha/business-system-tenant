'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ProblemNotice } from '@/components/problem-notice';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type { Problem } from '@/lib/problem';

/** The shape every server action behind a dialog returns. */
export type DialogFormState =
  | { status: 'idle' }
  | { status: 'saved'; message?: string }
  | { status: 'error'; message: string; problem?: Problem };

type Action<S extends DialogFormState> = (prev: S, form: FormData) => Promise<S>;

/**
 * A small form in a dialog — record a voucher, add a supplier, pay one. The
 * dialog closes and toasts on success; an error stays inline, beside the
 * fields that caused it, until it's fixed. The body unmounts on close, so the
 * next open starts clean.
 */
export function FormDialog<S extends DialogFormState>({
  trigger,
  title,
  description,
  action,
  submitLabel,
  success,
  children,
  wide = false,
  dismissLabel,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action: Action<S>;
  submitLabel: string;
  /** The toast on success — or built from what the action returned. */
  success: string | ((state: S) => string);
  children: ReactNode;
  wide?: boolean;
  /** The way out, when "Cancel" would read like the action itself ("Cancel voucher"). */
  dismissLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={wide ? 'sm:max-w-lg' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <FormBody
          action={action}
          submitLabel={submitLabel}
          success={success}
          dismissLabel={dismissLabel}
          onDone={() => setOpen(false)}
        >
          {children}
        </FormBody>
      </DialogContent>
    </Dialog>
  );
}

function FormBody<S extends DialogFormState>({
  action,
  submitLabel,
  success,
  onDone,
  children,
  dismissLabel,
}: {
  action: Action<S>;
  submitLabel: string;
  success: string | ((state: S) => string);
  onDone: () => void;
  children: ReactNode;
  dismissLabel?: string;
}) {
  const t = useTranslations('common');
  // React queues every submit, so a fast double click would record a payment
  // twice. A second submit is refused until the first one has answered.
  const sending = useRef(false);
  const [state, submit, pending] = useActionState<DialogFormState, FormData>(
    async (prev, form) => {
      try {
        const next = await action(prev as S, form);
        if (next.status === 'saved') {
          toast.success(typeof success === 'function' ? success(next) : success);
          onDone();
        }
        return next;
      } finally {
        sending.current = false;
      }
    },
    { status: 'idle' },
  );

  return (
    <form
      action={submit}
      onSubmit={(e) => {
        if (sending.current) e.preventDefault();
        else sending.current = true;
      }}
      className="grid gap-4"
    >
      {/* A disabled fieldset freezes every control inside while saving. */}
      <fieldset disabled={pending} className="grid gap-4">
        {children}
      </fieldset>
      {state.status === 'error' ? <ProblemNotice problem={state.problem} message={state.message} /> : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            {dismissLabel ?? t('cancel')}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} className="min-w-24">
          {pending ? <Spinner /> : null}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
