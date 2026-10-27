'use client';

import { Ban, Banknote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { recordSalesPayment, voidSalesInvoice } from '@/app/(app)/sales/actions';
import { FormDialog } from '@/components/forms/form-dialog';
import { MoneyInput } from '@/components/forms/money-input';
import { NumberField } from '@/components/forms/number-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { b, num } from '@/i18n/rich';
import { money } from '@/lib/format';
import { trimZeros } from '@/lib/purchase-line';
import type { Problem } from '@/lib/problem';
import { ProblemNotice } from '@/components/forms/problem-notice';

type Result = { ok: true } | { ok: false; message: string; problem?: Problem };
type Refusal = { message: string; problem?: Problem };

/**
 * Asks before posting — the step that takes the goods out of the warehouse
 * and books the sale — and takes what the customer pays on the spot. The rest
 * stays owed. `onPost` is the posting itself (the builder saves first).
 */
export function PostSalesDialog({
  trigger,
  total,
  customer,
  items,
  onPost,
  blocked,
}: {
  trigger: ReactNode;
  total: number;
  customer: string;
  /** "12 items", already worded. */
  items: string;
  onPost: (paidNow: string) => Promise<Result | void>;
  /** What already stands in the way of posting — explained instead of the form. */
  blocked?: Problem | null;
}) {
  const t = useTranslations('sales.post');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [paid, setPaid] = useState('');
  const [error, setError] = useState<Refusal | null>(null);
  const [pending, start] = useTransition();
  const sending = useRef(false);
  const over = Number(paid || 0) > total + 0.005;
  const owed = Math.max(0, total - Number(paid || 0));

  const post = () => {
    if (sending.current || over) return;
    sending.current = true;
    start(async () => {
      try {
        setError(null);
        const r = await onPost(paid);
        if (r && !r.ok) return void setError({ message: r.message, problem: r.problem });
        toast.success(t('posted'));
        setOpen(false);
      } finally {
        sending.current = false;
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (pending) return;
        setOpen(value);
        setError(null);
        if (value) setPaid('');
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t('title')}</DialogTitle>
          {blocked ? null : <DialogDescription>{t.rich('description', { items, total: money(total), customer, b, num })}</DialogDescription>}
        </DialogHeader>
        {blocked ? (
          <>
            <ProblemNotice problem={blocked} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc('close')}
              </Button>
            </DialogFooter>
          </>
        ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            post();
          }}
        >
          <Field>
            <FieldLabel htmlFor="si-paid-now">{t('paidNow')}</FieldLabel>
            <NumberField
              id="si-paid-now"
              value={paid}
              onValueChange={setPaid}
              group
              placeholder="0.00"
              aria-invalid={over}
              disabled={pending}
              suffix={tc('egp')}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setPaid('')}>
                {t('nothing')}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setPaid(trimZeros(total.toFixed(2)))}>
                {t('inFull')}
              </Button>
            </div>
            <FieldDescription>{t('paidNowHint')}</FieldDescription>
          </Field>
          <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px]">
            <span className="text-muted-foreground">{t('owedAfter')}</span>
            <span className={over ? 'num font-semibold text-destructive' : 'num font-semibold'}>{over ? '—' : money(owed)}</span>
          </div>
          {error ? <ProblemNotice problem={error.problem} message={error.message} /> : over ? <ProblemNotice message={t('tooMuch', { total: money(total) })} /> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending || over} className="min-w-24">
              {pending ? <Spinner /> : null}
              {t('confirm')}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Money received against one posted invoice — prefilled with what is left on it. */
export function RecordSalesPayment({ id, remaining, customer }: { id: string; remaining: string; customer: string }) {
  const t = useTranslations('sales.payments');
  const tr = useTranslations();
  return (
    <FormDialog
      trigger={
        <Button>
          <Banknote />
          {t('record')}
        </Button>
      }
      title={t('recordTitle')}
      description={t.rich('recordHint', { customer, b })}
      action={recordSalesPayment.bind(null, id)}
      submitLabel={t('record')}
      success={t('recorded')}
    >
      <Field>
        <FieldLabel htmlFor="si-pay-amount">{tr('money.vouchers.amount')}</FieldLabel>
        <MoneyInput id="si-pay-amount" name="amount" defaultValue={trimZeros(remaining)} autoFocus />
        <FieldDescription>{t.rich('left', { amount: money(remaining), num })}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="si-pay-memo">
          {tr('money.vouchers.note')} <span className="font-normal text-muted-foreground">{tr('common.optional')}</span>
        </FieldLabel>
        <Input id="si-pay-memo" name="memo" dir="auto" placeholder={t('memoPlaceholder')} />
      </Field>
    </FormDialog>
  );
}

/**
 * Voids a posted invoice entered by mistake, with the reason. While money has
 * been collected on it the dialog only explains that those payments are
 * reversed first — cash is never left without its invoice.
 */
export function VoidSalesInvoice({ id, number, blocked }: { id: string; number: string; blocked?: Problem | null }) {
  const t = useTranslations('sales.void');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Refusal | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (pending) return;
        setOpen(value);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:bg-destructive-subtle hover:text-destructive">
          <Ban />
          {t('action')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t('title', { number })}</DialogTitle>
          {blocked ? null : <DialogDescription>{t('description')}</DialogDescription>}
        </DialogHeader>
        {blocked ? (
          <>
            <ProblemNotice problem={blocked} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc('close')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              const reason = String(new FormData(e.currentTarget).get('reason') ?? '').trim();
              start(async () => {
                setError(null);
                const r = await voidSalesInvoice(id, reason);
                if (!r.ok) return void setError({ message: r.message, problem: r.problem });
                toast.success(t('done'));
                setOpen(false);
              });
            }}
          >
            <Field>
              <FieldLabel htmlFor="si-void-reason">{t('reason')}</FieldLabel>
              <Textarea id="si-void-reason" name="reason" required maxLength={1000} dir="auto" placeholder={t('reasonPlaceholder')} disabled={pending} />
            </Field>
            {error ? <ProblemNotice problem={error.problem} message={error.message} /> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
                {t('keep')}
              </Button>
              <Button type="submit" variant="destructive" disabled={pending} className="min-w-24">
                {pending ? <Spinner /> : null}
                {t('confirm')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
