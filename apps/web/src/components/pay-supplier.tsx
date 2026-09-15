import { Banknote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { paySupplier } from '@/app/(app)/money/actions';
import { FormDialog } from '@/components/form-dialog';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { money } from '@/lib/format';
import { num } from '@/i18n/rich';

export function PaySupplier({
  supplierId,
  owed,
  defaultAmount,
  invoiceId,
  trigger,
  hint,
}: {
  supplierId: string;
  owed: string;
  /** Prefill (e.g. one invoice's remainder); falls back to the whole balance. */
  defaultAmount?: string;
  /** When set, the payment settles this invoice specifically. */
  invoiceId?: string;
  trigger?: ReactNode;
  hint?: string;
}) {
  const t = useTranslations('money');
  const tc = useTranslations('common');
  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button disabled={Number(owed) <= 0}>
            <Banknote />
            {t('invoice.recordPayment')}
          </Button>
        )
      }
      title={t('pay.title')}
      description={hint ?? t('pay.hint')}
      action={paySupplier}
      submitLabel={t('invoice.recordPayment')}
      success={t('pay.recorded')}
    >
      <input type="hidden" name="id" value={supplierId} />
      {invoiceId ? <input type="hidden" name="invoiceId" value={invoiceId} /> : null}
      <Field>
        <FieldLabel htmlFor="pay-amount">{t('vouchers.amount')}</FieldLabel>
        <MoneyInput id="pay-amount" name="amount" defaultValue={defaultAmount ?? owed} autoFocus />
        <FieldDescription>{t.rich('pay.owedTotal', { amount: money(owed), num })}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="pay-memo">
          {t('vouchers.note')} <span className="font-normal text-muted-foreground">{tc('optional')}</span>
        </FieldLabel>
        <Input id="pay-memo" name="memo" placeholder={t('pay.memoPlaceholder')} />
      </Field>
    </FormDialog>
  );
}
