'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { signIn, type LoginState } from '@/app/login/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const INITIAL: LoginState = { status: 'idle' };

export function LoginForm() {
  const t = useTranslations('auth');
  const [state, submit, pending] = useActionState(signIn, INITIAL);
  const failed = state.status === 'error';

  return (
    <form action={submit}>
      <FieldGroup className="gap-4">
        <Field data-invalid={failed}>
          <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            disabled={pending}
            aria-invalid={failed}
            className="h-9"
          />
        </Field>
        <Field data-invalid={failed}>
          <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            aria-invalid={failed}
            className="h-9"
          />
        </Field>
        {failed ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? <Spinner /> : null}
          {pending ? t('submitting') : t('submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}
