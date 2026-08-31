'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { login } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} className="w-full">
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}

export default function LoginPage() {
  const [error, action] = useActionState(login, null);

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-[19rem]">
        <div className="mb-7">
          <h1 className="text-base font-semibold tracking-tight text-ink">Prime Market</h1>
          <p className="mt-0.5 text-xs text-ink-faint">Commerce operations</p>
        </div>

        <form action={action} className="flex flex-col gap-3">
          <Field label="Email">
            <Input
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              aria-invalid={!!error}
            />
          </Field>

          <Field label="Password">
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={!!error}
            />
          </Field>

          {error && (
            <p role="alert" className="text-xs text-bad">
              {error}
            </p>
          )}

          <div className="pt-1">
            <Submit />
          </div>
        </form>
      </div>
    </main>
  );
}
