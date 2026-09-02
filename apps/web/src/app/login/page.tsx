import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in · Prime Market' };

export default async function LoginPage() {
  if (await getSession()) redirect('/');

  return (
    <div className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-[360px]">
        <div className="mb-9 flex flex-col items-center text-center">
          <span className="mb-5 flex size-10 items-center justify-center rounded-[10px] bg-foreground text-base font-semibold text-background">
            P
          </span>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Prime Market</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <LoginForm />

        {process.env.NODE_ENV !== 'production' && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Development accounts: admin@admin.com / admin123 ·
            moderator@moderator.com / moderator123
          </p>
        )}
      </div>
    </div>
  );
}
