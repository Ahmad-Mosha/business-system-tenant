'use client';

import { useTranslations } from 'next-intl';
import { NumberField } from '@/components/number-field';

/**
 * An amount field for a form: grouped as you type (`1,250,000`), the plain
 * number submitted under `name`.
 */
export function MoneyInput({
  name,
  id,
  defaultValue = '',
  placeholder = '0.00',
  autoFocus,
  disabled,
  negative,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  negative?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <NumberField
      id={id}
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
      negative={negative}
      group
      suffix={t('egp')}
    />
  );
}
