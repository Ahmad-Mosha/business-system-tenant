'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

import { CommandMenu } from '@/components/layout/command-menu';
import { LanguageToggle } from '@/components/layout/language-switcher';
import { PrivacyToggle } from '@/components/layout/privacy-toggle';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { locate } from '@/lib/nav';
import { useFormat } from '@/i18n/use-format';
import type { Role } from '@/lib/session';

/** `privacy` is the eye's starting state, for admins — the only people shown costs. */
export function SiteHeader({ role, privacy }: { role: Role; privacy?: boolean }) {
  const t = useTranslations('nav');
  const f = useFormat();
  const pathname = usePathname();
  const here = locate(pathname);
  // What the path under a screen reads as: `new`, `edit`, a month, or a record.
  const tailLabel = (segment: string) =>
    segment === 'new'
      ? t('crumbs.new')
      : segment === 'edit'
        ? t('crumbs.edit')
        : /^\d{4}-\d{2}$/.test(segment)
          ? f.month(segment)
          : t('crumbs.details');
  const tail = here
    ? pathname
        .slice(here.item.href === '/' ? 1 : here.item.href.length + 1)
        .split('/')
        .filter(Boolean)
    : [];
  const crumbs = tail.map(tailLabel).filter((l, i, all) => !(l === t('crumbs.details') && all[i + 1]));

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 px-4 md:px-6">
      {/* Where you are — the two outer zones share the leftover width, so the search sits in the middle. */}
      <div className="flex min-w-0 items-center gap-2 sm:flex-1">
        <SidebarTrigger className="-ms-1.5" />
        <Separator orientation="vertical" className="me-1 hidden data-vertical:h-5 sm:block" />
        {here ? (
          // On a phone the page title sits right below; the search gets the room instead.
          <Breadcrumb className="hidden min-w-0 sm:block">
            <BreadcrumbList className="flex-nowrap text-[13px]">
              <BreadcrumbItem className="hidden items-center gap-1.5 md:inline-flex">
                <here.group.icon className="size-3.5" aria-hidden />
                {t(`groups.${here.group.key}`)}
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="min-w-0">
                {crumbs.length ? (
                  <BreadcrumbLink asChild>
                    <Link href={here.item.href} className="truncate">{t(`items.${here.item.key}`)}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate font-medium">{t(`items.${here.item.key}`)}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {crumbs.map((label, i) => (
                <Fragment key={`${label}-${i}`}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className={i === crumbs.length - 1 ? 'font-medium' : undefined}>{label}</BreadcrumbPage>
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 sm:w-64 sm:flex-none lg:w-96">
        <CommandMenu role={role} />
      </div>
      {/* One click each: light/dark, the other language, and — for admins — hiding money on screen. */}
      <div className="flex items-center justify-end gap-0.5 sm:flex-1">
        <ThemeToggle />
        <LanguageToggle compact className="hidden px-2 sm:inline-flex" />
        {privacy !== undefined ? <PrivacyToggle initial={privacy} /> : null}
      </div>
    </header>
  );
}
