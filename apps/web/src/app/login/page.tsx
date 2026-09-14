import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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
    <div className="relative flex h-svh items-center justify-center overflow-y-auto p-6">
      {/* Before signing in is when the language matters most — first-time
          visitors land in Arabic, and English is one click away. */}
      <LanguageToggle className="absolute top-4 end-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 flex size-10 items-center justify-center bg-primary font-heading text-base font-bold text-primary-foreground">
            {t('app.name').charAt(0)}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{t('app.name')}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t('auth.title')}</p>
        </div>

        <LoginForm />

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
