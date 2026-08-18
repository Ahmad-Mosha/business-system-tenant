import {
  PERMISSIONS,
  type ListOrdersQuery,
  type ListOrdersResponse,
  type OrderListItem,
} from '@app/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { aliasedTable, and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import { DB, schema, type Database } from '../../db/db.module.js';
import type { AuthContext } from '../identity/auth-context.js';

const assignee = aliasedTable(schema.users, 'assignee');

@Injectable()
export class OrdersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Scope is resolved here, next to the query it constrains, and applied as a WHERE
   * clause rather than by filtering rows after the fact. A moderator's request cannot
   * load another moderator's orders into memory even briefly.
   */
  async list(auth: AuthContext, query: ListOrdersQuery): Promise<ListOrdersResponse> {
    const scope = auth.requireScope(PERMISSIONS.ORDER_READ);

    const conditions: SQL[] = [eq(schema.orders.organizationId, auth.user.organizationId)];
    if (scope === 'ASSIGNED') {
      conditions.push(eq(schema.orders.assignedToUserId, auth.user.id));
    }
    if (query.status) {
      conditions.push(eq(schema.orders.status, query.status));
    }
    const where = and(...conditions);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({
          id: schema.orders.id,
          orderNumber: schema.orders.orderNumber,
          source: schema.orders.source,
          status: schema.orders.status,
          customerName: schema.orders.customerName,
          customerPhone: schema.orders.customerPhone,
          grandTotal: schema.orders.grandTotal,
          currency: schema.orders.currency,
          placedAt: schema.orders.placedAt,
          assigneeId: assignee.id,
          assigneeName: assignee.name,
          itemCount: sql<number>`(
            select coalesce(sum(${schema.orderLines.quantity}), 0)::int
            from ${schema.orderLines}
            where ${schema.orderLines.orderId} = ${schema.orders.id}
          )`,
        })
        .from(schema.orders)
        .leftJoin(assignee, eq(assignee.id, schema.orders.assignedToUserId))
        .where(where)
        .orderBy(desc(schema.orders.placedAt), desc(schema.orders.id))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ value: count() }).from(schema.orders).where(where),
    ]);

    return {
      items: rows.map(toListItem),
      total: totals?.value ?? 0,
    };
  }
}

type OrderRow = {
  id: string;
  orderNumber: string;
  source: OrderListItem['source'];
  status: OrderListItem['status'];
  customerName: string;
  customerPhone: string;
  grandTotal: number;
  currency: string;
  placedAt: Date;
  assigneeId: string | null;
  assigneeName: string | null;
  itemCount: number;
};

function toListItem(row: OrderRow): OrderListItem {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    source: row.source,
    status: row.status,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    total: { amount: row.grandTotal, currency: row.currency },
    assignedTo:
      row.assigneeId && row.assigneeName
        ? { id: row.assigneeId, name: row.assigneeName }
        : null,
    itemCount: row.itemCount,
    placedAt: row.placedAt.toISOString(),
  };
}
