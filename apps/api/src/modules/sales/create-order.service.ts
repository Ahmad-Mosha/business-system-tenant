import {
  PERMISSIONS,
  type CreateOrderRequest,
  type CreateOrderResponse,
} from '@app/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DB, schema, type Database } from '../../db/db.module.js';
import { DomainError } from '../../shared/errors.js';
import { newId } from '../../shared/ids.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../identity/auth-context.js';
import { InvalidAssigneeError } from './order-detail.service.js';

export class UnknownVariantError extends DomainError {
  constructor(ids: string[]) {
    super(
      'UNKNOWN_VARIANT',
      `These products are not in the catalog: ${ids.join(', ')}`,
      422,
    );
  }
}

@Injectable()
export class CreateOrderService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creates a social/phone order taken by a person.
   *
   * Every line must resolve to a catalog variant: a manual order is typed by someone
   * who can see the catalog, so there is no reason to accept an unmatched product here
   * (unlike ingestion, where the channel decides what arrives).
   */
  async create(
    auth: AuthContext,
    input: CreateOrderRequest,
    correlationId?: string,
  ): Promise<CreateOrderResponse> {
    const scope = auth.requireScope(PERMISSIONS.ORDER_CREATE);
    const organizationId = auth.user.organizationId;

    const variantIds = [...new Set(input.lines.map((l) => l.variantId))];
    const known = await this.db
      .select({ id: schema.variants.id, name: schema.variants.name })
      .from(schema.variants)
      .where(
        and(
          eq(schema.variants.organizationId, organizationId),
          inArray(schema.variants.id, variantIds),
        ),
      );

    const knownById = new Map(known.map((v) => [v.id, v]));
    const missing = variantIds.filter((id) => !knownById.has(id));
    if (missing.length > 0) throw new UnknownVariantError(missing);

    const assigneeId = await this.resolveAssignee(auth, scope, input.assigneeId);

    const itemsTotal = input.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const grandTotal = itemsTotal + input.shippingTotal - input.discountTotal;

    const orderId = newId();
    const [seq] = await this.db.execute<{ nextval: string }>(
      sql`select nextval('order_number_seq') as nextval`,
    );
    const orderNumber = `SO-${String(seq?.nextval ?? Date.now()).padStart(5, '0')}`;

    await this.db.transaction(async (tx) => {
      await tx.insert(schema.orders).values({
        id: orderId,
        organizationId,
        orderNumber,
        source: 'MANUAL',
        status: 'NEW',
        assignedToUserId: assigneeId,
        customerName: input.customerName,
        customerPhone: normalisePhone(input.customerPhone),
        customerPhoneRaw: input.customerPhone,
        customerAddress: input.customerAddress ?? null,
        customerGovernorate: input.customerGovernorate ?? null,
        itemsTotal,
        shippingTotal: input.shippingTotal,
        discountTotal: input.discountTotal,
        grandTotal,
        placedAt: new Date(),
        createdByUserId: auth.user.id,
      });

      await tx.insert(schema.orderLines).values(
        input.lines.map((line, index) => ({
          id: newId(),
          organizationId,
          orderId,
          externalLineId: `M${index + 1}`,
          variantId: line.variantId,
          resolution: 'RESOLVED' as const,
          externalSku: null,
          externalTitle: knownById.get(line.variantId)?.name ?? 'Unknown product',
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.unitPrice * line.quantity,
        })),
      );

      await tx.insert(schema.orderStatusHistory).values({
        id: newId(),
        orderId,
        fromStatus: null,
        toStatus: 'NEW',
        changedByUserId: auth.user.id,
        note: 'Order created manually',
      });

      if (assigneeId) {
        await tx.insert(schema.orderAssignments).values({
          id: newId(),
          orderId,
          assignedToUserId: assigneeId,
          assignedByUserId: auth.user.id,
        });
      }
    });

    await this.audit.record({
      actor: { type: 'USER', userId: auth.user.id, organizationId },
      action: 'order.created',
      entityType: 'order',
      entityId: orderId,
      data: { orderNumber, source: 'MANUAL', lines: input.lines.length, grandTotal },
      correlationId,
    });

    return { id: orderId, orderNumber };
  }

  /**
   * A moderator only ever sees their own orders, so an order they create must be
   * theirs - otherwise they would file it and immediately lose sight of it.
   */
  private async resolveAssignee(
    auth: AuthContext,
    scope: 'ALL' | 'ASSIGNED',
    requested?: string,
  ): Promise<string | null> {
    if (scope === 'ASSIGNED') return auth.user.id;
    if (!requested) return null;

    const [target] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, requested),
          eq(schema.users.organizationId, auth.user.organizationId),
          eq(schema.users.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!target) throw new InvalidAssigneeError();
    return target.id;
  }
}

/** Stored in a single canonical form so the same customer is recognisable. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+20')) return digits;
  if (digits.startsWith('20')) return `+${digits}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
  return `+20${digits}`;
}
