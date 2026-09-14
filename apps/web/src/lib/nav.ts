import {
  BarChart3,
  BookText,
  CalendarRange,
  ClipboardList,
  LayoutGrid,
  Package,
  Receipt,
  ShoppingBag,
  Truck,
  Upload,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/session';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  /** Match the path exactly, for a section root that has children. */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * The one definition of where things live — the sidebar, the breadcrumbs and
 * the command menu all read it. `roles` hides what a user cannot use; the API
 * refuses it regardless.
 */
export const NAVIGATION: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { href: '/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/shipments', label: 'Shipments', icon: Truck },
      { href: '/inventory', label: 'Inventory', icon: Package, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/money', label: 'Overview', icon: Wallet, roles: ['ADMIN'], exact: true },
      { href: '/money/treasury', label: 'Treasury', icon: Receipt, roles: ['ADMIN'] },
      { href: '/money/purchases', label: 'Purchases', icon: ClipboardList, roles: ['ADMIN'] },
      { href: '/money/suppliers', label: 'Suppliers', icon: Users, roles: ['ADMIN'] },
      { href: '/money/ledger', label: 'Ledger', icon: BookText, roles: ['ADMIN'] },
    ],
  },
  {
    // These four screens all answer one question — what noon owes and why.
    label: 'noon',
    items: [
      { href: '/', label: 'Overview', icon: LayoutGrid, roles: ['ADMIN'], exact: true },
      { href: '/months', label: 'Months', icon: CalendarRange, roles: ['ADMIN'] },
      { href: '/products', label: 'Products', icon: BarChart3, roles: ['ADMIN'] },
      { href: '/imports', label: 'Imports', icon: Upload, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Admin',
    items: [{ href: '/team', label: 'Team', icon: UserCog, roles: ['ADMIN'] }],
  },
];

export function navFor(role: Role): NavGroup[] {
  return NAVIGATION.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The section and screen a path belongs to — the longest matching entry wins. */
export function locate(pathname: string): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of NAVIGATION) {
    for (const item of group.items) {
      const hit =
        pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
      if (hit && (!best || item.href.length > best.item.href.length)) best = { group, item };
    }
  }
  return best;
}
