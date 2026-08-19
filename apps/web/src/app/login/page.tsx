import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getCurrentUser } from '@/lib/session';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/orders');

  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-[24rem]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-primary-ink">
            P
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">PRIME</h1>
          <p className="mt-1 text-[13px] text-ink-2">Secure system access</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-[12px] text-ink-3">
          Accounts are created by an administrator.
        </p>
      </div>
    </div>
  );
}
