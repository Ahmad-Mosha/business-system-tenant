'use client';

import { ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTransition } from 'react';
import { signOut } from '@/app/login/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { isActive, navFor } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';

/**
 * The active item gets three signals at once — a teal rail on its left edge,
 * a teal icon, and the filled row — so "where am I" reads at a glance even
 * with the sidebar collapsed to icons.
 */
const ITEM =
  'relative text-[13px] text-sidebar-foreground/75 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:bg-sidebar-primary before:opacity-0 before:transition-opacity data-active:text-sidebar-foreground data-active:before:opacity-100 data-active:[&>svg]:text-sidebar-primary [&>svg]:text-sidebar-foreground/60 hover:[&>svg]:text-sidebar-foreground';

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const groups = navFor(user.role);

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
                  <span className="truncate text-[11px] text-muted-foreground">Operations</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(pathname, item)}
                    tooltip={item.label}
                    className={ITEM}
                  >
                    <Link
                      href={item.href}
                      onClick={() => isMobile && setOpenMobile(false)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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

function NavUser({ user }: { user: SessionUser }) {
  const { isMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const [signingOut, startSignOut] = useTransition();
  const dark = resolvedTheme === 'dark';
  const initial = user.name.slice(0, 1).toUpperCase();

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
                  {initial}
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
            <DropdownMenuItem
              disabled={signingOut}
              onSelect={() => startSignOut(() => signOut())}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
