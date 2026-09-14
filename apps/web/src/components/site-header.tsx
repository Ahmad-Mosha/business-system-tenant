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

import { locate } from '@/lib/nav';
import { useFormat } from '@/i18n/use-format';

export function SiteHeader() {
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
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ms-1.5" />
      <Separator orientation="vertical" className="me-1 data-vertical:h-4" />
      {here ? (
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="hidden md:inline-flex">{t(`groups.${here.group.key}`)}</BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              {crumbs.length ? (
                <BreadcrumbLink asChild>
                  <Link href={here.item.href}>{t(`items.${here.item.key}`)}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{t(`items.${here.item.key}`)}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {crumbs.map((label, i) => (
              <Fragment key={`${label}-${i}`}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
    </header>
  );
}
