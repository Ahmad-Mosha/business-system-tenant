import {
  BarChart3,
  BookText,
  CalendarRange,
  ClipboardList,
  LayoutGrid,
  Package,
  Receipt,
  ShoppingBag,
  Store,
  Truck,
  Upload,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/session';
import type messages from '@/messages/en.json';

/** Names live in the messages (`nav.items.*`, `nav.groups.*`); this file only says where things are. */
type ItemKey = keyof (typeof messages)['nav']['items'];
type GroupKey = keyof (typeof messages)['nav']['groups'];

export interface NavItem {
  href: string;
  key: ItemKey;
  icon: LucideIcon;
  roles?: Role[];
  /** Match the path exactly, for a section root that has children. */
  exact?: boolean;
}

export interface NavGroup {
  key: GroupKey;
  /** The module's icon in the sidebar. */
  icon: LucideIcon;
  /** Listed as plain links rather than a collapsible module. */
  flat?: boolean;
  items: NavItem[];
}

/**
 * The one definition of where things live — the sidebar and the breadcrumbs
 * both read it. `roles` hides what a user cannot use; the API
 * refuses it regardless.
 */
export const NAVIGATION: NavGroup[] = [
  {
    key: 'operations',
    icon: ShoppingBag,
    items: [
      { href: '/orders', key: 'orders', icon: ShoppingBag },
      { href: '/shipments', key: 'shipments', icon: Truck },
      { href: '/inventory', key: 'inventory', icon: Package, roles: ['ADMIN'] },
    ],
  },
  {
    key: 'money',
    icon: Wallet,
    items: [
      { href: '/money', key: 'moneyOverview', icon: Wallet, roles: ['ADMIN'], exact: true },
      { href: '/money/expenses', key: 'expenses', icon: Receipt, roles: ['ADMIN'] },
      { href: '/money/treasury', key: 'treasury', icon: Receipt, roles: ['ADMIN'] },
      { href: '/money/purchases', key: 'purchases', icon: ClipboardList, roles: ['ADMIN'] },
      { href: '/money/suppliers', key: 'suppliers', icon: Users, roles: ['ADMIN'] },
      { href: '/money/ledger', key: 'ledger', icon: BookText, roles: ['ADMIN'] },
    ],
  },
  {
    // These four screens all answer one question — what noon owes and why.
    key: 'noon',
    icon: Store,
    items: [
      { href: '/', key: 'noonOverview', icon: LayoutGrid, roles: ['ADMIN'], exact: true },
      { href: '/months', key: 'months', icon: CalendarRange, roles: ['ADMIN'] },
      { href: '/products', key: 'products', icon: BarChart3, roles: ['ADMIN'] },
      { href: '/imports', key: 'imports', icon: Upload, roles: ['ADMIN'] },
    ],
  },
  {
    key: 'admin',
    icon: UserCog,
    flat: true,
    items: [{ href: '/team', key: 'team', icon: UserCog, roles: ['ADMIN'] }],
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
