'use client';

import { ChevronRight, ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useState, useTransition } from 'react';
import { signOut } from '@/app/login/actions';
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
import { isActive, navFor, type NavGroup } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';

/**
 * Where-am-I, at every level: the module holding the current screen gets a
 * teal icon, and the screen itself a teal mark on the module's guide rail
 * plus the filled row.
 */
const SUB_ITEM =
  'relative text-[13px] text-sidebar-foreground/75 before:absolute before:inset-y-1 before:-start-[11px] before:w-0.5 before:bg-sidebar-primary before:opacity-0 before:transition-opacity data-active:font-medium data-active:text-sidebar-foreground data-active:before:opacity-100';

export function AppSidebar({ user }: { user: SessionUser }) {
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
                <span className="flex aspect-square size-8 items-center justify-center bg-primary font-heading text-sm font-bold text-primary-foreground">
                  P
                </span>
                <span className="grid flex-1 leading-tight">
                  <span className="truncate font-heading text-sm font-semibold">{t('app.name')}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{t('app.tagline')}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.modules')}</SidebarGroupLabel>
          <SidebarMenu>
            {modules.map((m) => (
              <NavModule key={m.key} module={m} pathname={pathname} />
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
                      className="text-[13px] data-active:[&>svg]:text-sidebar-primary"
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
function NavModule({ module: m, pathname }: { module: NavGroup; pathname: string }) {
  const t = useTranslations('nav');
  const rtl = useDirection() === 'rtl';
  const { state, isMobile, setOpenMobile } = useSidebar();
  const label = t(`groups.${m.key}`);
  const current = m.items.some((i) => isActive(pathname, i));
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? current;
  const close = () => isMobile && setOpenMobile(false);

  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label={label}
              className={cn(current && 'bg-sidebar-accent [&>svg]:text-sidebar-primary')}
            >
              <m.icon />
              <span>{label}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {/* Opens toward the content, whichever side the sidebar is on. */}
          <DropdownMenuContent side={rtl ? 'left' : 'right'} align="start" className="min-w-44">
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            {m.items.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href} className={cn(isActive(pathname, item) && 'font-medium')}>
                  {t(`items.${item.key}`)}
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
            className={cn('text-[13px]', current && 'font-medium [&>svg:first-child]:text-sidebar-primary')}
          >
            <m.icon />
            <span>{label}</span>
            <ChevronRight className="ms-auto text-muted-foreground rtl:rotate-180 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {m.items.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton asChild isActive={isActive(pathname, item)} className={SUB_ITEM}>
                  <Link href={item.href} onClick={close}>
                    <span>{t(`items.${item.key}`)}</span>
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
                <AvatarFallback className="bg-sidebar-accent font-heading text-xs font-semibold">
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
            <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => signOut())}>
              <LogOut className="rtl:-scale-x-100" />
              {t('user.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
