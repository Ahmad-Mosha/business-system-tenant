import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getCurrentUser } from '@/lib/session';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/orders');

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Left: quiet context. No illustration, no gradient - just type and space. */}
      <aside className="hidden flex-col justify-between border-r border-rule bg-sunken px-14 py-12 lg:flex">
        <p className="font-display text-2xl leading-none">Operations</p>
        <div className="max-w-md">
          <p className="font-display text-[42px] leading-[1.1] tracking-tight text-ink">
            Every order, every cost, one reliable record.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-ink-soft">
            Orders from every channel, resolved to real products, with a traceable
            history behind every number.
          </p>
        </div>
        <p className="text-[13px] text-ink-faint">
          Internal system &middot; authorised access only
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[22rem]">
          <p className="mb-10 font-display text-2xl leading-none lg:hidden">Operations</p>
          <h1 className="text-[22px] font-medium tracking-tight text-ink">Sign in</h1>
          <p className="mt-1.5 mb-8 text-sm text-ink-soft">
            Use the account your administrator created for you.
          </p>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
