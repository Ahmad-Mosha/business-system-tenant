'use client';

import { ChevronRight, ChevronsUpDown, ClipboardList, FileText, LogOut, Moon, Package, Plus, ShoppingBag, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useState, useTransition } from 'react';
import { signOut } from '@/app/login/actions';
import { clearAllDrafts } from '@/hooks/use-draft';
import { BrandMark } from '@/components/brand-mark';
import { LanguageMenuGroup } from '@/components/language-switcher';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDirection } from '@/components/ui/direction';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { isActive, navFor, type NavGroup, type NavItem } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';

/**
 * Where-am-I, at every level: the module holding the current screen gets a
 * teal icon, and the screen itself a teal mark on the module's guide rail
 * plus the filled row.
 */
const SUB_ITEM =
  'relative h-8 text-[13.5px] text-sidebar-foreground/75 before:absolute before:inset-y-1 before:-start-[11px] before:w-0.5 before:bg-sidebar-primary before:opacity-0 before:transition-opacity data-active:font-medium data-active:text-sidebar-foreground data-active:before:opacity-100';

/** How many records wait on each screen, by its nav key — only screens with a count. */
type Counts = Partial<Record<NavItem['key'], number>>;

export function AppSidebar({ user, counts = {} }: { user: SessionUser; counts?: Counts }) {
  const t = useTranslations();
  const pathname = usePathname();
  const groups = navFor(user.role);
  const modules = groups.filter((g) => !g.flat);
  const flat = groups.filter((g) => g.flat);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={t('app.name')}>
              <Link href={user.role === 'ADMIN' ? '/' : '/orders'}>
                <BrandMark />
                <span className="grid flex-1 leading-tight">
                  <span className="truncate font-heading text-[14px] font-semibold tracking-[-0.01em]">{t('app.name')}</span>
                  <span className="truncate text-[11.5px] text-muted-foreground">{t('app.tagline')}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <QuickCreate role={user.role} />
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.modules')}</SidebarGroupLabel>
          <SidebarMenu>
            {modules.map((m) => (
              <NavModule key={m.key} module={m} pathname={pathname} counts={counts} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {flat.map((g) => (
          <SidebarGroup key={g.key}>
            <SidebarGroupLabel>{t(`nav.groups.${g.key}`)}</SidebarGroupLabel>
            <SidebarMenu>
              {g.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={t(`nav.items.${item.key}`)}
                      className="h-9 text-sm data-active:[&>svg]:text-sidebar-primary"
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{t(`nav.items.${item.key}`)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * One module — Operations, Money, noon — that folds open to its screens. It
 * starts open when it holds the current screen; after that, open or closed is
 * the user's call. Collapsed to icons there's no room to fold open, so the
 * icon opens a menu of the module's screens instead.
 */
function NavModule({ module: m, pathname, counts }: { module: NavGroup; pathname: string; counts: Counts }) {
  const t = useTranslations('nav');
  const rtl = useDirection() === 'rtl';
  const { state, isMobile, setOpenMobile } = useSidebar();
  const label = t(`groups.${m.key}`);
  const current = m.items.some((i) => isActive(pathname, i));
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? current;
  const close = () => isMobile && setOpenMobile(false);
  const waiting = m.items.reduce((n, i) => n + (counts[i.key] ?? 0), 0);

  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label={label}
              className={cn('relative', current && 'bg-sidebar-accent [&>svg]:text-sidebar-primary')}
            >
              <m.icon />
              <span>{label}</span>
              {/* Collapsed to icons, a waiting count shows as a dot. */}
              {waiting ? <span aria-hidden className="absolute top-1 end-1 size-1.5 rounded-full bg-warning" /> : null}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {/* Opens toward the content, whichever side the sidebar is on. */}
          <DropdownMenuContent side={rtl ? 'left' : 'right'} align="start" className="min-w-44">
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            {m.items.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href} className={cn(isActive(pathname, item) && 'font-medium')}>
                  {t(`items.${item.key}`)}
                  {counts[item.key] ? <Count value={counts[item.key]!} label={t('needsWork', { count: counts[item.key]! })} /> : null}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild open={open} onOpenChange={setChosen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={label}
            className={cn('h-9 text-sm', current && 'font-medium [&>svg:first-child]:text-sidebar-primary')}
          >
            <m.icon />
            <span>{label}</span>
            {/* Folded shut, the module still says something inside it is waiting. */}
            {waiting && !open ? <Count value={waiting} label={t('needsWork', { count: waiting })} /> : null}
            <ChevronRight className={cn('text-muted-foreground rtl:rotate-180 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90', !(waiting && !open) && 'ms-auto')} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {m.items.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton asChild isActive={isActive(pathname, item)} className={SUB_ITEM}>
                  <Link href={item.href} onClick={close}>
                    <span className="truncate">{t(`items.${item.key}`)}</span>
                    {counts[item.key] ? <Count value={counts[item.key]!} label={t('needsWork', { count: counts[item.key]! })} /> : null}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function NavUser({ user }: { user: SessionUser }) {
  const t = useTranslations();
  const rtl = useDirection() === 'rtl';
  const { isMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const [signingOut, startSignOut] = useTransition();
  const dark = resolvedTheme === 'dark';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-sidebar-accent font-heading text-xs font-semibold text-sidebar-accent-foreground">
                  {user.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 leading-tight">
                <span className="truncate text-[13px] font-medium">{user.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {t(`enums.role.${user.role}`)}
                </span>
              </span>
              <ChevronsUpDown className="ms-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? 'bottom' : rtl ? 'left' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-[13px] font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => setTheme(dark ? 'light' : 'dark')}>
                {dark ? <Sun /> : <Moon />}
                {dark ? t('user.lightTheme') : t('user.darkTheme')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <LanguageMenuGroup />
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => { clearAllDrafts(); return signOut(); })}>
              <LogOut className="rtl:-scale-x-100" />
              {t('user.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** A count of records waiting on a screen — amber, because each one needs someone. */
function Count({ value, label }: { value: number; label: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="num ms-auto shrink-0 rounded-full bg-warning/15 px-1.5 py-px text-[11px] font-semibold text-warning"
    >
      {value}
    </span>
  );
}

/**
 * The everyday "new" moves, one click from anywhere: a moderator only ever
 * creates orders, so they get that button; an admin gets a short menu.
 */
function QuickCreate({ role }: { role: SessionUser['role'] }) {
  const t = useTranslations('nav.create');
  const rtl = useDirection() === 'rtl';
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => isMobile && setOpenMobile(false);
  const button = 'mt-1 h-9 justify-center bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-xs hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground active:bg-sidebar-primary/90 active:text-sidebar-primary-foreground [&>svg]:opacity-100';

  if (role !== 'ADMIN') {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={t('order')} className={button}>
          <Link href="/orders/new" onClick={close}>
            <Plus />
            <span>{t('order')}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const items = [
    { href: '/orders/new', label: t('order'), icon: ShoppingBag },
    { href: '/sales/new', label: t('salesInvoice'), icon: FileText },
    { href: '/money/purchases/new', label: t('purchase'), icon: ClipboardList },
    { href: '/inventory/new', label: t('product'), icon: Package },
  ];
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={t('label')} className={button}>
            <Plus />
            <span>{t('label')}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={isMobile ? 'bottom' : rtl ? 'left' : 'right'} align="start" className="min-w-48">
          <DropdownMenuLabel>{t('label')}</DropdownMenuLabel>
          {items.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href} onClick={close}>
                <item.icon />
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
