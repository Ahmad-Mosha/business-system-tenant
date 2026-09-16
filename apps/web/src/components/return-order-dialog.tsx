'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { setOrderStatus } from '@/app/(app)/orders/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** A return is a received-goods decision, never an accidental one-click status. */
export function ReturnOrderDialog({ orderId, open, onOpenChange }: {
  orderId: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('orders.return');
  const tc = useTranslations('common');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!pending) { setError(null); onOpenChange(value); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('title')}</DialogTitle><DialogDescription>{t('description')}</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          start(async () => {
            setError(null);
            const result = await setOrderStatus(orderId, 'RETURNED', {
              reason: String(data.get('reason') ?? ''), restock: data.get('condition') === 'sellable',
            });
            if (!result.ok) { setError(result.message); return; }
            toast.success(t('saved'));
            onOpenChange(false);
          });
        }}>
          <fieldset disabled={pending} className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor={`reason-${orderId}`}>{t('reason')}</Label><Textarea id={`reason-${orderId}`} name="reason" required maxLength={1000} dir="auto" /></div>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">{t('condition')}</legend>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="condition" value="sellable" required className="mt-1" />{t('sellable')}</label>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="condition" value="damaged" required className="mt-1" />{t('damaged')}</label>
            </fieldset>
            <p className="text-xs text-muted-foreground">{t('refundHint')}</p>
          </fieldset>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter><Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>{tc('cancel')}</Button><Button type="submit" disabled={pending}>{t('submit')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
