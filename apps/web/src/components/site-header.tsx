'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { monthLabel } from '@/lib/format';
import { locate } from '@/lib/nav';

/** What the path under a screen reads as: `new`, `edit`, a month, or a record. */
function tailLabel(segment: string): string {
  if (segment === 'new') return 'New';
  if (segment === 'edit') return 'Edit';
  if (/^\d{4}-\d{2}$/.test(segment)) return monthLabel(segment);
  return 'Details';
}

/**
 * The strip above every screen: the sidebar toggle and where you are. Screen
 * titles and actions live in the page itself.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const here = locate(pathname);
  const tail = here
    ? pathname
        .slice(here.item.href === '/' ? 1 : here.item.href.length + 1)
        .split('/')
        .filter(Boolean)
    : [];
  const crumbs = tail.map(tailLabel).filter((l, i, all) => !(l === 'Details' && all[i + 1]));

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ms-1.5" />
      <Separator orientation="vertical" className="me-1 data-vertical:h-4" />
      {here ? (
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="hidden md:inline-flex">{here.group.label}</BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              {crumbs.length ? (
                <BreadcrumbLink asChild>
                  <Link href={here.item.href}>{here.item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{here.item.label}</BreadcrumbPage>
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
