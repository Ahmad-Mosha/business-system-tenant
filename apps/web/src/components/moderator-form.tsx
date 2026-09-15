'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { addModerator } from '@/app/(app)/team/actions';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function ModeratorForm() {
  const t = useTranslations('team');
  return (
    <FormDialog
      trigger={
        <Button>
          <UserPlus />
          {t('add')}
        </Button>
      }
      title={t('add')}
      description={t('addHint')}
      action={addModerator}
      submitLabel={t('add')}
      success={(state) => (state.status === 'saved' && state.message) || t('added')}
    >
      <Field>
        <FieldLabel htmlFor="mod-name">{t('name')}</FieldLabel>
        <Input id="mod-name" name="name" dir="auto" placeholder={t('namePlaceholder')} autoFocus required />
      </Field>
      <Field>
        <FieldLabel htmlFor="mod-email">{t('email')}</FieldLabel>
        <Input id="mod-email" name="email" type="email" placeholder="aya@prime.com" required />
      </Field>
      <Field>
        <FieldLabel htmlFor="mod-password">{t('password')}</FieldLabel>
        <Input
          id="mod-password"
          name="password"
          type="text"
          placeholder={t('passwordPlaceholder')}
          required
          minLength={6}
        />
        <FieldDescription>{t('passwordHint')}</FieldDescription>
      </Field>
    </FormDialog>
  );
}
