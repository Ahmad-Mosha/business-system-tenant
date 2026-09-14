'use client';

import { ChevronRight, ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState, useTransition } from 'react';
import { signOut } from '@/app/login/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  'relative text-[13px] text-sidebar-foreground/75 before:absolute before:inset-y-1 before:-left-[11px] before:w-0.5 before:bg-sidebar-primary before:opacity-0 before:transition-opacity data-active:font-medium data-active:text-sidebar-foreground data-active:before:opacity-100';

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const groups = navFor(user.role);
  const modules = groups.filter((g) => !g.flat);
  const flat = groups.filter((g) => g.flat);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Prime Market">
              <Link href={user.role === 'ADMIN' ? '/' : '/orders'}>
                <span className="flex aspect-square size-8 items-center justify-center bg-primary font-heading text-sm font-bold text-primary-foreground">
                  P
                </span>
                <span className="grid flex-1 leading-tight">
                  <span className="truncate font-heading text-sm font-semibold">Prime Market</span>
                  <span className="truncate text-[11px] text-muted-foreground">Operations system</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarMenu>
            {modules.map((m) => (
              <NavModule key={m.label} module={m} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {flat.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarMenu>
              {g.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className="text-[13px] data-active:[&>svg]:text-sidebar-primary"
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
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
  const { state, isMobile, setOpenMobile } = useSidebar();
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
              aria-label={m.label}
              className={cn(current && 'bg-sidebar-accent [&>svg]:text-sidebar-primary')}
            >
              <m.icon />
              <span>{m.label}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-44">
            <DropdownMenuLabel>{m.label}</DropdownMenuLabel>
            {m.items.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href} className={cn(isActive(pathname, item) && 'font-medium')}>
                  {item.label}
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
            tooltip={m.label}
            className={cn('text-[13px]', current && 'font-medium [&>svg:first-child]:text-sidebar-primary')}
          >
            <m.icon />
            <span>{m.label}</span>
            <ChevronRight className="ml-auto text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {m.items.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton asChild isActive={isActive(pathname, item)} className={SUB_ITEM}>
                  <Link href={item.href} onClick={close}>
                    <span>{item.label}</span>
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
                <span className="truncate text-[11px] text-muted-foreground capitalize">
                  {user.role.toLowerCase()}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? 'bottom' : 'right'}
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
                {dark ? 'Light theme' : 'Dark theme'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => signOut())}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
