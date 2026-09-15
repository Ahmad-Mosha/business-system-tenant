'use client';

import { ArrowDownLeft, ArrowUpRight, Banknote, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { recordCheque, recordVoucher } from '@/app/(app)/money/actions';
import { DatePicker, todayISO } from '@/components/date-picker';
import { FormDialog } from '@/components/form-dialog';
import { MoneyInput } from '@/components/money-input';
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

function VoucherDialog({ kind, trigger }: { kind: keyof typeof VOUCHERS; trigger: React.ReactNode }) {
  const t = useTranslations('money.vouchers');
  const tr = useTranslations();
  const v = VOUCHERS[kind];
  return (
    <FormDialog
      trigger={trigger}
      title={t(v.title)}
      description={t(v.hint)}
      action={recordVoucher}
      submitLabel={t('record')}
      success={t('recorded')}
    >
      <input type="hidden" name="direction" value={v.direction} />
      {v.fixedCounter ? <input type="hidden" name="counter" value={v.fixedCounter} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={`${kind}-amount`}>{t('amount')}</FieldLabel>
          <MoneyInput id={`${kind}-amount`} name="amount" autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${kind}-date`}>{t('date')}</FieldLabel>
          <DatePicker id={`${kind}-date`} name="occurredAt" defaultValue={todayISO()} />
        </Field>
      </div>

      {!v.fixedCounter ? (
        <Field>
          <FieldLabel htmlFor={`${kind}-counter`}>
            {v.direction === 'OUT' ? t('whatFor') : t('source')}
          </FieldLabel>
          <Select name="counter">
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
        <Input id={`${kind}-memo`} name="memo" dir="auto" placeholder={t('memoPlaceholder')} />
      </Field>
    </FormDialog>
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
