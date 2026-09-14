'use client';

import { AlertTriangle } from 'lucide-react';
import { useActionState, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

/** The shape every server action behind a dialog returns. */
export type DialogFormState =
  | { status: 'idle' }
  | { status: 'saved'; message?: string }
  | { status: 'error'; message: string };

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
}: {
  action: Action<S>;
  submitLabel: string;
  success: string | ((state: S) => string);
  onDone: () => void;
  children: ReactNode;
}) {
  const [state, submit, pending] = useActionState<DialogFormState, FormData>(
    async (prev, form) => {
      const next = await action(prev as S, form);
      if (next.status === 'saved') {
        toast.success(typeof success === 'function' ? success(next) : success);
        onDone();
      }
      return next;
    },
    { status: 'idle' },
  );

  return (
    <form action={submit} className="grid gap-4">
      {/* A disabled fieldset freezes every control inside while saving. */}
      <fieldset disabled={pending} className="grid gap-4">
        {children}
      </fieldset>
      {state.status === 'error' ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            Cancel
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
