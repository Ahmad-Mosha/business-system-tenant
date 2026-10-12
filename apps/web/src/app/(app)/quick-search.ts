'use server';

import type { CustomerRow, OrderRow, OrderStatus, ProductRow } from '@/lib/api';
import { apiRequest } from '@/lib/api-request';
import { getSession } from '@/lib/session';

export interface QuickResults {
  orders: Array<{ id: string; orderNumber: string; customerName: string; total: string; status: OrderStatus }>;
  products: Array<{ id: string; name: string; onHand: number }>;
  customers: Array<{ id: string; name: string; phone: string | null; balance: string }>;
}

const LIMIT = 5;

/**
 * What the search palette finds for a term: orders for everyone — the API
 * already limits a moderator to their own — and products and customers for
 * admins, the only people with those screens.
 */
export async function quickSearch(term: string): Promise<QuickResults> {
  const q = term.trim();
  const none: QuickResults = { orders: [], products: [], customers: [] };
  const user = q.length >= 2 ? await getSession() : null;
  if (!user) return none;
  const admin = user.role === 'ADMIN';
  const query = encodeURIComponent(q);
  const [orders, products, customers] = await Promise.all([
    apiRequest<{ orders: OrderRow[] }>(`/orders?search=${query}&limit=${LIMIT}`, 'GET'),
    admin ? apiRequest<ProductRow[]>(`/catalog/products?search=${query}&limit=${LIMIT}`, 'GET') : null,
    // ponytail: customers are filtered here, not by the API — fine while the
    // list is a few hundred wholesale accounts; add `?search=` when it isn't.
    admin ? apiRequest<CustomerRow[]>('/customers', 'GET') : null,
  ]);
  const needle = q.toLowerCase();
  return {
    orders: orders.ok
      ? orders.data.orders.slice(0, LIMIT).map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          total: o.total,
          status: o.status,
        }))
      : [],
    products: products?.ok ? products.data.slice(0, LIMIT).map((p) => ({ id: p.id, name: p.name, onHand: p.onHand })) : [],
    customers: customers?.ok
      ? customers.data
          .filter((c) => c.name.toLowerCase().includes(needle) || c.phone?.includes(q))
          .slice(0, LIMIT)
          .map((c) => ({ id: c.id, name: c.name, phone: c.phone, balance: c.balance }))
      : [],
  };
}
