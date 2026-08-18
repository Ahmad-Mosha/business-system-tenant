'use client';

import { loginRequestSchema, type ApiError } from '@app/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from './ui/button';
import { Field } from './ui/field';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Catch obvious mistakes without a round trip. The API validates independently -
    // this is convenience, not the check that counts.
    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });

      if (res.ok) {
        router.replace('/orders');
        router.refresh();
        return;
      }

      const body = (await res.json().catch(() => null)) as ApiError | null;
      if (body?.error.details) {
        const errors: Record<string, string> = {};
        for (const [key, messages] of Object.entries(body.error.details)) {
          if (messages[0]) errors[key] = messages[0];
        }
        setFieldErrors(errors);
      }
      setFormError(body?.error.message ?? 'Sign in failed. Please try again.');
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
        >
          {formError}
        </p>
      ) : null}

      <Field
        label="Email"
        type="email"
        name="email"
        autoComplete="username"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
      />

      <Field
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
      />

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Signing in' : 'Sign in'}
      </Button>
    </form>
  );
}
