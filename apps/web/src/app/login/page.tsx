import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/brand-mark';
import { LanguageToggle } from '@/components/language-switcher';
import { LoginForm } from '@/components/login-form';
import { getSession } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('pageTitle') };
}

export default async function LoginPage() {
  if (await getSession()) redirect('/');
  const t = await getTranslations();

  return (
    <div className="relative isolate flex h-svh items-center justify-center overflow-y-auto bg-canvas p-6">
      {/* A soft teal light from above and a fading dot grid: depth without a picture to load. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_28rem_at_50%_-10%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(color-mix(in_srgb,var(--foreground)_9%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] bg-size-[22px_22px]"
      />
      {/* Before signing in is when the language matters most — first-time
          visitors land in Arabic, and English is one click away. */}
      <LanguageToggle className="absolute top-4 end-4" />
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandMark className="mb-5 size-11 rounded-xl text-xl" />
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{t('app.name')}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{t('auth.title')}</p>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-lg ring-1 ring-foreground/8 sm:p-7">
          <LoginForm />
        </div>

        {process.env.NODE_ENV !== 'production' ? (
          /* eslint-disable react/jsx-no-literals -- dev-only seed accounts: data, not copy */
          <p className="mt-8 text-center text-xs text-muted-foreground">
            {t('auth.devAccounts')} <bdi className="text-foreground">admin@admin.com</bdi> / admin123 ·{' '}
            <bdi className="text-foreground">moderator@moderator.com</bdi> / moderator123
          </p>
          /* eslint-enable react/jsx-no-literals */
        ) : null}
      </div>
    </div>
  );
}
