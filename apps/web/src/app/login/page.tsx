import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in · Prime Market' };

export default async function LoginPage() {
  if (await getSession()) redirect('/');

  return (
    <div className="flex h-svh items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 flex size-10 items-center justify-center bg-primary font-heading text-base font-bold text-primary-foreground">
            P
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Prime Market</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Sign in to continue</p>
        </div>

        <LoginForm />

        {process.env.NODE_ENV !== 'production' ? (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Development accounts: <span className="text-foreground">admin@admin.com</span> / admin123 ·{' '}
            <span className="text-foreground">moderator@moderator.com</span> / moderator123
          </p>
        ) : null}
      </div>
    </div>
  );
}
