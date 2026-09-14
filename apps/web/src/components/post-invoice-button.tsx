'use client';

import { Send } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { postInvoice } from '@/app/(app)/money/actions';
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
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { money } from '@/lib/format';

/**
 * Posts a draft invoice — the one irreversible step in purchasing (stock moves
 * in, the ledger books it), so it asks first and says exactly what happens.
 */
export function PostInvoiceButton({ id, total }: { id: string; total: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const post = () =>
    start(async () => {
      const form = new FormData();
      form.set('id', id);
      const result = await postInvoice({ status: 'idle' }, form);
      if (result.status === 'error') toast.error(result.message);
      if (result.status === 'saved') {
        toast.success('Invoice posted — stock and the ledger updated.');
        setOpen(false);
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button>
          <Send />
          Post invoice
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Post this invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="num text-foreground">{money(total)}</span> of stock comes in at cost and
            the money is booked. Posting can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Not yet</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              post();
            }}
          >
            {pending ? <Spinner /> : null}
            Post invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
