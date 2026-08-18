import {
  ALLOWED_TRANSITIONS,
  PERMISSIONS,
  canTransition,
  type AssignableUser,
  type OrderDetail,
  type OrderStatus,
  type TimelineEntry,
} from '@app/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { aliasedTable, and, asc, desc, eq, isNull } from 'drizzle-orm';
import { DB, schema, type Database } from '../../db/db.module.js';
import { DomainError } from '../../shared/errors.js';
import { newId } from '../../shared/ids.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../identity/auth-context.js';

export class OrderNotFoundError extends DomainError {
  constructor() {
    super('ORDER_NOT_FOUND', 'That order does not exist, or is not yours to view', 404);
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(
      'INVALID_TRANSITION',
      `An order cannot move from ${from} to ${to}`,
      422,
    );
  }
}

export class InvalidAssigneeError extends DomainError {
  constructor() {
    super('INVALID_ASSIGNEE', 'That person cannot be assigned orders', 422);
  }
}

const assignee = aliasedTable(schema.users, 'assignee');
const actor = aliasedTable(schema.users, 'actor');
const assignedBy = aliasedTable(schema.users, 'assigned_by');
const assignedTo = aliasedTable(schema.users, 'assigned_to');

@Injectable()
export class OrderDetailService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async get(auth: AuthContext, orderId: string): Promise<OrderDetail> {
    const order = await this.loadScoped(auth, orderId);

    // Named promises rather than an inline Promise.all tuple: TypeScript loses the
    // row shapes when three differently-shaped drizzle builders are inlined together.
    const linesQuery = this.db
      .select({
        id: schema.orderLines.id,
        externalTitle: schema.orderLines.externalTitle,
        externalSku: schema.orderLines.externalSku,
        variantId: schema.orderLines.variantId,
        sku: schema.variants.sku,
        resolution: schema.orderLines.resolution,
        quantity: schema.orderLines.quantity,
        unitPrice: schema.orderLines.unitPrice,
        lineTotal: schema.orderLines.lineTotal,
      })
      .from(schema.orderLines)
      .leftJoin(schema.variants, eq(schema.variants.id, schema.orderLines.variantId))
      .where(eq(schema.orderLines.orderId, orderId))
      .orderBy(asc(schema.orderLines.createdAt));

    const statusQuery = this.db
      .select({
        at: schema.orderStatusHistory.occurredAt,
        from: schema.orderStatusHistory.fromStatus,
        to: schema.orderStatusHistory.toStatus,
        note: schema.orderStatusHistory.note,
        actorName: actor.name,
      })
      .from(schema.orderStatusHistory)
      .leftJoin(actor, eq(actor.id, schema.orderStatusHistory.changedByUserId))
      .where(eq(schema.orderStatusHistory.orderId, orderId))
      .orderBy(desc(schema.orderStatusHistory.occurredAt));

    const assignmentQuery = this.db
      .select({
        at: schema.orderAssignments.assignedAt,
        toName: assignedTo.name,
        byName: assignedBy.name,
      })
      .from(schema.orderAssignments)
      .leftJoin(assignedTo, eq(assignedTo.id, schema.orderAssignments.assignedToUserId))
      .leftJoin(assignedBy, eq(assignedBy.id, schema.orderAssignments.assignedByUserId))
      .where(eq(schema.orderAssignments.orderId, orderId))
      .orderBy(desc(schema.orderAssignments.assignedAt));

    const lines = await linesQuery;
    const statusRows = await statusQuery;
    const assignmentRows = await assignmentQuery;

    const timeline: TimelineEntry[] = [
      ...statusRows.map((r) => ({
        at: r.at.toISOString(),
        kind: 'STATUS' as const,
        title: r.from ? `${r.from} → ${r.to}` : `Order ${r.to}`,
        detail: r.note,
        actorName: r.actorName,
      })),
      ...assignmentRows.map((r) => ({
        at: r.at.toISOString(),
        kind: 'ASSIGNMENT' as const,
        title: `Assigned to ${r.toName ?? 'someone'}`,
        detail: null,
        actorName: r.byName,
      })),
      {
        at: order.createdAt.toISOString(),
        kind: 'AUDIT' as const,
        title: 'Order created',
        detail: `Source: ${order.source}`,
        actorName: null,
      },
    ].sort((a, b) => b.at.localeCompare(a.at));

    const currency = order.currency;
    const money = (amount: number) => ({ amount, currency });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      source: order.source,
      status: order.status,
      availableTransitions: this.transitionsFor(auth, order.status),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      customerGovernorate: order.customerGovernorate,
      assignedTo:
        order.assigneeId && order.assigneeName
          ? { id: order.assigneeId, name: order.assigneeName }
          : null,
      lines: lines.map((l) => ({
        id: l.id,
        externalTitle: l.externalTitle,
        externalSku: l.externalSku,
        sku: l.sku,
        variantId: l.variantId,
        resolution: l.resolution,
        quantity: l.quantity,
        unitPrice: money(l.unitPrice),
        lineTotal: money(l.lineTotal),
      })),
      itemsTotal: money(order.itemsTotal),
      shippingTotal: money(order.shippingTotal),
      discountTotal: money(order.discountTotal),
      total: money(order.grandTotal),
      timeline,
      placedAt: order.placedAt.toISOString(),
    };
  }

  /** Admins assign; the assignee must be a real, active member of the organization. */
  async assign(auth: AuthContext, orderId: string, assigneeId: string, correlationId?: string) {
    auth.requireScope(PERMISSIONS.ORDER_ASSIGN);
    const order = await this.loadScoped(auth, orderId);

    const [target] = await this.db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, assigneeId),
          eq(schema.users.organizationId, auth.user.organizationId),
          eq(schema.users.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!target) throw new InvalidAssigneeError();

    if (order.assigneeId === target.id) return;

    await this.db.transaction(async (tx) => {
      // Close the previous holder's period rather than overwriting it: who worked an
      // order and when has to survive a reassignment.
      await tx
        .update(schema.orderAssignments)
        .set({ unassignedAt: new Date() })
        .where(
          and(
            eq(schema.orderAssignments.orderId, orderId),
            isNull(schema.orderAssignments.unassignedAt),
          ),
        );
      await tx.insert(schema.orderAssignments).values({
        id: newId(),
        orderId,
        assignedToUserId: target.id,
        assignedByUserId: auth.user.id,
      });
      await tx
        .update(schema.orders)
        .set({ assignedToUserId: target.id, updatedAt: new Date() })
        .where(eq(schema.orders.id, orderId));
    });

    await this.audit.record({
      actor: { type: 'USER', userId: auth.user.id, organizationId: auth.user.organizationId },
      action: 'order.assigned',
      entityType: 'order',
      entityId: orderId,
      data: { from: order.assigneeId, to: target.id, orderNumber: order.orderNumber },
      correlationId,
    });
  }

  async updateStatus(
    auth: AuthContext,
    orderId: string,
    to: OrderStatus,
    note: string | undefined,
    correlationId?: string,
  ) {
    auth.requireScope(PERMISSIONS.ORDER_UPDATE_STATUS);
    const order = await this.loadScoped(auth, orderId);

    if (!canTransition(order.status, to)) {
      throw new InvalidTransitionError(order.status, to);
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.orders)
        .set({ status: to, updatedAt: new Date() })
        .where(eq(schema.orders.id, orderId));
      await tx.insert(schema.orderStatusHistory).values({
        id: newId(),
        orderId,
        fromStatus: order.status,
        toStatus: to,
        changedByUserId: auth.user.id,
        note: note ?? null,
      });
    });

    await this.audit.record({
      actor: { type: 'USER', userId: auth.user.id, organizationId: auth.user.organizationId },
      action: 'order.status.changed',
      entityType: 'order',
      entityId: orderId,
      data: { from: order.status, to, note: note ?? null, orderNumber: order.orderNumber },
      correlationId,
    });
  }

  async listAssignable(auth: AuthContext): Promise<AssignableUser[]> {
    auth.requireScope(PERMISSIONS.USER_READ);
    const rows = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.roles.code,
      })
      .from(schema.users)
      .leftJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
      .leftJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(
        and(
          eq(schema.users.organizationId, auth.user.organizationId),
          eq(schema.users.status, 'ACTIVE'),
        ),
      )
      .orderBy(asc(schema.users.name));

    const byId = new Map<string, AssignableUser>();
    for (const row of rows) {
      const existing = byId.get(row.id);
      if (existing) {
        if (row.role) existing.roles.push(row.role);
      } else {
        byId.set(row.id, {
          id: row.id,
          name: row.name,
          email: row.email,
          roles: row.role ? [row.role] : [],
        });
      }
    }
    return [...byId.values()];
  }

  /**
   * Loads an order through the caller's scope, so a moderator asking for an order
   * that is not theirs gets the same "not found" as for one that does not exist -
   * an existence oracle is a leak in itself.
   */
  private async loadScoped(auth: AuthContext, orderId: string) {
    const scope = auth.requireScope(PERMISSIONS.ORDER_READ);
    const conditions = [
      eq(schema.orders.id, orderId),
      eq(schema.orders.organizationId, auth.user.organizationId),
    ];
    if (scope === 'ASSIGNED') {
      conditions.push(eq(schema.orders.assignedToUserId, auth.user.id));
    }

    const [order] = await this.db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        source: schema.orders.source,
        status: schema.orders.status,
        customerName: schema.orders.customerName,
        customerPhone: schema.orders.customerPhone,
        customerAddress: schema.orders.customerAddress,
        customerGovernorate: schema.orders.customerGovernorate,
        itemsTotal: schema.orders.itemsTotal,
        shippingTotal: schema.orders.shippingTotal,
        discountTotal: schema.orders.discountTotal,
        grandTotal: schema.orders.grandTotal,
        currency: schema.orders.currency,
        placedAt: schema.orders.placedAt,
        createdAt: schema.orders.createdAt,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
      })
      .from(schema.orders)
      .leftJoin(assignee, eq(assignee.id, schema.orders.assignedToUserId))
      .where(and(...conditions))
      .limit(1);

    if (!order) throw new OrderNotFoundError();
    return order;
  }

  private transitionsFor(auth: AuthContext, from: OrderStatus): OrderStatus[] {
    if (!auth.scopeFor(PERMISSIONS.ORDER_UPDATE_STATUS)) return [];
    return ALLOWED_TRANSITIONS[from];
  }
}
