'use client';

import { ArrowDownLeft, ArrowUpRight, Ban, Banknote, FileText, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cancelVoucher, correctVoucher, recordCheque, recordVoucher } from '@/app/(app)/money/actions';
import { DatePicker, todayISO } from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import { MoneyInput } from '@/components/money-input';
import { ReasonField } from '@/components/reason-field';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VOUCHER_COUNTERS } from '@/lib/money';

/** The three cash vouchers — `money.vouchers` names each one. */
const VOUCHERS = {
  deposit: { direction: 'IN', fixedCounter: 'OWNER_CAPITAL', title: 'deposit', hint: 'depositHint' },
  in: { direction: 'IN', fixedCounter: null, title: 'cashIn', hint: 'inHint' },
  out: { direction: 'OUT', fixedCounter: null, title: 'cashOut', hint: 'outHint' },
} as const;

/** Every hand-entered cash movement, as the Treasury screen's actions. */
export function TreasuryActions() {
  const t = useTranslations('money.vouchers');
  return (
    <>
      <ChequeDialog
        trigger={
          <Button variant="outline">
            <FileText />
            {t('cheque')}
          </Button>
        }
      />
      <VoucherDialog
        kind="out"
        trigger={
          <Button variant="outline">
            <ArrowUpRight className="rtl:-scale-x-100" />
            {t('cashOut')}
          </Button>
        }
      />
      <VoucherDialog
        kind="in"
        trigger={
          <Button variant="outline">
            <ArrowDownLeft className="rtl:-scale-x-100" />
            {t('cashIn')}
          </Button>
        }
      />
      <VoucherDialog
        kind="deposit"
        trigger={
          <Button>
            <Banknote />
            {t('deposit')}
          </Button>
        }
      />
    </>
  );
}

function Optional() {
  const t = useTranslations('common');
  return <span className="font-normal text-muted-foreground">{t('optional')}</span>;
}

/** A voucher as recorded, to correct: the form opens filled with it. */
interface VoucherDraft {
  entryId: string;
  amount: string;
  date: string;
  counter: string;
  memo: string | null;
}

function VoucherDialog({ kind, trigger, edit }: { kind: keyof typeof VOUCHERS; trigger: React.ReactNode; edit?: VoucherDraft }) {
  const t = useTranslations('money.vouchers');
  const tc = useTranslations('corrections.voucher');
  const tr = useTranslations();
  const v = VOUCHERS[kind];
  return (
    <FormDialog
      trigger={trigger}
      title={edit ? tc('edit') : t(v.title)}
      description={edit ? tc('editHint') : t(v.hint)}
      action={edit ? correctVoucher.bind(null, edit.entryId) : recordVoucher}
      submitLabel={edit ? tc('save') : t('record')}
      success={edit ? tc('corrected') : t('recorded')}
    >
      <input type="hidden" name="direction" value={v.direction} />
      {v.fixedCounter ? <input type="hidden" name="counter" value={v.fixedCounter} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={`${kind}-amount`}>{t('amount')}</FieldLabel>
          <MoneyInput id={`${kind}-amount`} name="amount" defaultValue={edit?.amount} autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${kind}-date`}>{t('date')}</FieldLabel>
          <DatePicker id={`${kind}-date`} name="occurredAt" defaultValue={edit?.date ?? todayISO()} />
        </Field>
      </div>

      {!v.fixedCounter ? (
        <Field>
          <FieldLabel htmlFor={`${kind}-counter`}>
            {v.direction === 'OUT' ? t('whatFor') : t('source')}
          </FieldLabel>
          <Select name="counter" defaultValue={edit?.counter}>
            <SelectTrigger id={`${kind}-counter`} className="w-full">
              <SelectValue placeholder={tr('common.choose')} />
            </SelectTrigger>
            <SelectContent position="popper">
              {VOUCHER_COUNTERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {tr(`enums.voucherCounter.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <Field>
        <FieldLabel htmlFor={`${kind}-memo`}>
          {t('note')} <Optional />
        </FieldLabel>
        <Input id={`${kind}-memo`} name="memo" dir="auto" defaultValue={edit?.memo ?? undefined} placeholder={t('memoPlaceholder')} />
      </Field>
      {edit ? <ReasonField /> : null}
    </FormDialog>
  );
}

/**
 * Edit and Cancel for one hand-entered voucher in the treasury. Neither
 * changes the voucher itself: cancelling reverses it, editing reverses it and
 * records the corrected one — both stay in the history.
 */
export function VoucherRowActions({
  entryId,
  effect,
  counter,
  amount,
  occurredAt,
  memo,
}: {
  entryId: string;
  /** Its signed effect on the treasury: positive came in. */
  effect: number;
  /** The account on the other side. */
  counter: string;
  amount: string;
  occurredAt: string;
  memo: string | null;
}) {
  const t = useTranslations('corrections');
  const kind = effect > 0 ? (counter === 'OWNER_CAPITAL' ? 'deposit' : 'in') : 'out';
  return (
    <span className="flex items-center justify-end gap-0.5">
      <VoucherDialog
        kind={kind}
        edit={{ entryId, amount, date: occurredAt.slice(0, 10), counter, memo }}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={t('voucher.edit')} title={t('voucher.edit')}>
            <Pencil />
          </Button>
        }
      />
      <FormDialog
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={t('voucher.cancel')} title={t('voucher.cancel')} className="hover:text-destructive">
            <Ban />
          </Button>
        }
        title={t('voucher.cancel')}
        description={t('voucher.cancelHint')}
        action={cancelVoucher.bind(null, entryId)}
        submitLabel={t('voucher.cancel')}
        success={t('voucher.cancelledToast')}
        dismissLabel={t('keep')}
      >
        <ReasonField />
      </FormDialog>
    </span>
  );
}

function ChequeDialog({ trigger }: { trigger: React.ReactNode }) {
  const t = useTranslations('money.vouchers');
  return (
    <FormDialog
      trigger={trigger}
      title={t('chequeTitle')}
      description={t('chequeHint')}
      action={recordCheque}
      submitLabel={t('recordCheque')}
      success={t('chequeRecorded')}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="cheque-amount">{t('amount')}</FieldLabel>
          <MoneyInput id="cheque-amount" name="amount" autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="cheque-from">{t('from')}</FieldLabel>
          <Input id="cheque-from" name="fromParty" dir="auto" placeholder={t('fromPlaceholder')} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cheque-received">{t('received')}</FieldLabel>
          <DatePicker id="cheque-received" name="receivedDate" defaultValue={todayISO()} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cheque-due">
            {t('due')} <Optional />
          </FieldLabel>
          <DatePicker id="cheque-due" name="dueDate" placeholder={t('noDueDate')} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="cheque-memo">
          {t('note')} <Optional />
        </FieldLabel>
        <Input id="cheque-memo" name="memo" placeholder={t('chequeMemoPlaceholder')} />
      </Field>
    </FormDialog>
  );
}
