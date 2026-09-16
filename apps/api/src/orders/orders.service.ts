import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { SessionUser } from '../auth/auth.guard';
import { ChannelListing } from '../catalog/channel-listing.entity';
import { FinanceService } from '../finance/finance.service';
import { StockMovement } from '../inventory/stock-movement.entity';
import { OrderEvent } from './order-event.entity';
import { OrderItem } from './order-item.entity';
import {
  ALLOWED_TRANSITIONS,
  EGYPT_GOVERNORATES,
  Order,
  type OrderStatus,
  type PaymentStatus,
} from './order.entity';
import { problem } from '../problem';
import { lockStock } from '../inventory/stock-lock';

/** Egyptian mobile: 01[0125] + 8 digits, with or without a +20/0020/20 prefix. */
const EGYPT_PHONE = /^(?:\+?20|0)?1[0125]\d{8}$/;
const GOVERNORATES = new Set<string>(EGYPT_GOVERNORATES);

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  governorate?: string;
  address?: string;
  paymentMethod?: 'COD' | 'INSTAPAY' | 'WALLET';
  shippingCost?: string;
  notes?: string;
  items: Array<{ variantId?: string; title?: string; quantity: number; unitPrice: string }>;
}

export interface OrderFilters {
  status?: OrderStatus;
  source?: string;
  assignedToId?: string;
  unassigned?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly finance: FinanceService,
  ) {}

  async onModuleInit() {
    // A database sequence, so two concurrent orders can never share a number.
    await this.db.query('CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000');
  }

  private async nextOrderNumber(tx: EntityManager): Promise<string> {
    const [{ nextval }] = await tx.query("SELECT nextval('order_number_seq')");
    return `PM-${nextval}`;
  }

  /**
   * A moderator only ever sees their own orders. The restriction is applied to
   * the query itself, so a guessed id or a direct API call returns nothing
   * rather than someone else's customer.
   */
  private scope(user: SessionUser, filters: OrderFilters): OrderFilters {
    if (user.role === 'ADMIN') return filters;
    return { ...filters, assignedToId: user.id, unassigned: false };
  }

  async list(user: SessionUser, rawFilters: OrderFilters) {
    const f = this.scope(user, rawFilters);
    const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
    const offset = Math.max(f.offset ?? 0, 0);

    const where: string[] = [];
    const params: unknown[] = [];
    /** Binds a value and returns its placeholder, so numbering stays in step. */
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (f.assignedToId) where.push(`o.assigned_to_id = ${bind(f.assignedToId)}`);
    if (f.unassigned) where.push('o.assigned_to_id IS NULL');
    if (f.status) where.push(`o.status = ${bind(f.status)}`);
    if (f.source) where.push(`o.source = ${bind(f.source)}`);
    if (f.search) {
      const term = bind(`%${f.search}%`); // one placeholder, referenced three times
      where.push(
        `(o.customer_name ILIKE ${term} OR o.customer_phone ILIKE ${term} OR o.order_number ILIKE ${term})`,
      );
    }

    const finalSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await this.db.query(
      `SELECT o.id, o.order_number AS "orderNumber", o.source, o.status,
              o.payment_status AS "paymentStatus", o.payment_method AS "paymentMethod",
              o.customer_name AS "customerName", o.customer_phone AS "customerPhone",
              o.governorate, o.total, o.placed_at AS "placedAt",
              o.assigned_to_id AS "assignedToId", u.name AS "assignedToName",
              o.tracking_number AS "trackingNumber",
              (SELECT count(*)::int FROM order_item i WHERE i.order_id = o.id) AS "itemCount",
              (SELECT count(*)::int FROM order_item i WHERE i.order_id = o.id AND i.variant_id IS NULL) AS "unmappedCount",
              count(*) OVER()::int AS "totalCount"
       FROM customer_order o
       LEFT JOIN app_user u ON u.id = o.assigned_to_id
       ${finalSql}
       ORDER BY o.placed_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    return {
      orders: rows,
      total: rows[0]?.totalCount ?? 0,
      limit,
      offset,
    };
  }

  async get(user: SessionUser, id: string) {
    const order = await this.db.getRepository(Order).findOne({
      where: user.role === 'ADMIN' ? { id } : { id, assignedToId: user.id },
      relations: { items: true, assignedTo: true },
    });
    if (!order) throw new NotFoundException(problem('notFound', 'order not found'));

    const events = await this.db.getRepository(OrderEvent).find({
      where: { orderId: id },
      order: { createdAt: 'DESC' },
    });
    // The password hash is never selected, but drop the whole nested user
    // anyway and expose only what the UI needs.
    return {
      ...order,
      assignedTo: order.assignedTo
        ? { id: order.assignedTo.id, name: order.assignedTo.name }
        : null,
      events,
    };
  }

  /** Manual creation, used for orders that arrive through social conversations. */
  async create(user: SessionUser, input: CreateOrderInput) {
    if (!input.customerName?.trim()) throw new BadRequestException(problem('order.customerName', 'customer name is required'));

    const phone = (input.customerPhone ?? '').replace(/[\s-]/g, '').replace(/^00/, '+');
    if (!EGYPT_PHONE.test(phone)) {
      throw new BadRequestException(problem('order.phone', 'enter a valid Egyptian mobile number, e.g. 010 1234 5678'));
    }

    const governorate = input.governorate?.trim() ?? '';
    if (!GOVERNORATES.has(governorate)) {
      throw new BadRequestException(problem('order.governorate', 'choose a governorate'));
    }

    if (!input.items?.length) throw new BadRequestException(problem('order.noItems', 'an order needs at least one item'));
    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException(problem('order.itemQuantity', 'every item needs a whole quantity of at least 1'));
      }
      if (!/^\d+(\.\d{1,2})?$/.test(item.unitPrice ?? '') || Number(item.unitPrice) <= 0) {
        throw new BadRequestException(problem('order.itemPrice', 'every item needs a price greater than 0'));
      }
    }

    return this.db.transaction(async (tx) => {
      const variantIds = input.items.map((i) => i.variantId).filter(Boolean) as string[];
      const titles = await this.titlesFor(tx, variantIds);
      await this.assertStockAvailable(tx, input.items);

      const items = input.items.map((i) =>
        tx.create(OrderItem, {
          variantId: i.variantId ?? null,
          title: i.title?.trim() || titles.get(i.variantId ?? '') || 'Item',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: (Number(i.unitPrice) * i.quantity).toFixed(2),
        }),
      );

      const subtotal = items.reduce((n, i) => n + Number(i.lineTotal), 0);
      const shipping = Number(input.shippingCost ?? 0);

      const order = await tx.save(Order, {
        orderNumber: await this.nextOrderNumber(tx),
        source: 'SOCIAL' as const,
        externalId: null,
        // A moderator creating an order already owns it.
        status: user.role === 'MODERATOR' ? ('ASSIGNED' as const) : ('NEW' as const),
        assignedToId: user.role === 'MODERATOR' ? user.id : null,
        createdById: user.id,
        customerName: input.customerName.trim(),
        customerPhone: phone,
        governorate,
        address: input.address?.trim() || null,
        paymentMethod: input.paymentMethod ?? 'COD',
        notes: input.notes?.trim() || null,
        subtotal: subtotal.toFixed(2),
        shippingCost: shipping.toFixed(2),
        total: (subtotal + shipping).toFixed(2),
        items,
      });

      await OrdersService.debitStockForOrder(tx, items, order.id);
      await this.record(tx, order.id, 'CREATED', null, 'SOCIAL', user);
      return order;
    });
  }

  /**
   * A manual order is ours to refuse, unlike a channel order that already
   * happened out in the world — so this is the one creation path that blocks
   * on stock instead of letting on-hand run negative.
   * Locks serialize stock checks against every other writer. Repeated lines
   * for the same variant count as one combined request.
   */
  private async assertStockAvailable(
    tx: EntityManager,
    items: Array<{ variantId?: string; quantity: number }>,
  ): Promise<void> {
    const linked = items.filter((i) => i.variantId);
    if (!linked.length) return;
    await lockStock(tx, linked.map((i) => i.variantId as string));
    const requested = new Map<string, number>();
    for (const item of linked) {
      const id = item.variantId as string;
      requested.set(id, (requested.get(id) ?? 0) + item.quantity);
    }

    const rows: Array<{ id: string; name: string; onHand: number }> = await tx.query(
      `SELECT v.id, COALESCE(v.name || ' — ' || p.name, p.name) AS name,
              COALESCE((SELECT SUM(quantity) FROM stock_movement m WHERE m.variant_id = v.id AND m.location = 'WAREHOUSE'), 0)::int AS "onHand"
       FROM product_variant v JOIN product p ON p.id = v.product_id
       WHERE v.id = ANY($1)`,
      [linked.map((i) => i.variantId)],
    );
    const onHand = new Map(rows.map((r) => [r.id, r]));

    for (const [id, quantity] of requested) {
      const stock = onHand.get(id);
      if (!stock) throw new BadRequestException(problem('notFound', 'variant not found'));
      if (quantity > stock.onHand) {
        throw new BadRequestException(
          problem('order.stockShort', `${stock.name}: only ${stock.onHand} in stock, ${quantity} requested`, {
            name: stock.name,
            onHand: stock.onHand,
            requested: quantity,
          }),
        );
      }
    }
  }

  async assign(orderId: string, assigneeId: string | null, actor: SessionUser) {
    return this.db.transaction(async (tx) => {
      const order = await tx.findOne(Order, { where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException(problem('notFound', 'order not found'));
      const previous = order.assignedToId;
      if (previous === assigneeId) return order;
      order.assignedToId = assigneeId;
      if (assigneeId && order.status === 'NEW') order.status = 'ASSIGNED';
      if (!assigneeId && order.status === 'ASSIGNED') order.status = 'NEW';
      await tx.save(order);
      await this.record(tx, orderId, 'ASSIGNED', previous, assigneeId ?? 'unassigned', actor);
      return order;
    });
  }

  /**
   * Which states an order may still be edited in. Once it is with the courier
   * the goods have physically left, so changing what was in the box would make
   * the stock ledger describe something that never happened.
   */
  private static readonly EDITABLE: OrderStatus[] = ['NEW', 'ASSIGNED', 'CONFIRMED'];

  /**
   * Edit a manual order in place. Stock is not patched — the old lines are
   * credited back and the new ones debited, so the movement history keeps
   * saying what actually happened rather than being rewritten.
   */
  async update(user: SessionUser, orderId: string, input: CreateOrderInput) {
    if (!input.customerName?.trim()) throw new BadRequestException(problem('order.customerName', 'customer name is required'));

    const phone = (input.customerPhone ?? '').replace(/[\s-]/g, '').replace(/^00/, '+');
    if (!EGYPT_PHONE.test(phone)) {
      throw new BadRequestException(problem('order.phone', 'enter a valid Egyptian mobile number, e.g. 010 1234 5678'));
    }

    const governorate = input.governorate?.trim() ?? '';
    if (!GOVERNORATES.has(governorate)) throw new BadRequestException(problem('order.governorate', 'choose a governorate'));

    if (!input.items?.length) throw new BadRequestException(problem('order.noItems', 'an order needs at least one item'));
    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException(problem('order.itemQuantity', 'every item needs a whole quantity of at least 1'));
      }
      if (!/^\d+(\.\d{1,2})?$/.test(item.unitPrice ?? '') || Number(item.unitPrice) <= 0) {
        throw new BadRequestException(problem('order.itemPrice', 'every item needs a price greater than 0'));
      }
    }

    return this.db.transaction(async (tx) => {
      const order = await tx.findOne(Order, {
        where: user.role === 'ADMIN' ? { id: orderId } : { id: orderId, assignedToId: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException(problem('notFound', 'order not found'));

      if (!OrdersService.EDITABLE.includes(order.status)) {
        throw new BadRequestException(
          problem(
            'order.locked',
            `a ${order.status.toLowerCase()} order can no longer be edited — it has left the warehouse`,
            { status: order.status },
          ),
        );
      }

      if (order.paymentStatus !== 'UNPAID') {
        throw new BadRequestException(problem('order.paidEdit', 'reverse the payment before editing a paid or refunded order'));
      }
      const oldItems = await tx.find(OrderItem, { where: { orderId } });
      await lockStock(tx, [...oldItems, ...input.items].flatMap((i) => i.variantId ? [i.variantId] : []));

      // Put the old lines' stock back before asking whether the new ones fit,
      // so re-saving an unchanged order never trips its own availability check.
      await OrdersService.creditStockForOrder(tx, orderId, 'EDITED');
      await tx.delete(OrderItem, { orderId });
      await this.assertStockAvailable(tx, input.items);

      const variantIds = input.items.map((i) => i.variantId).filter(Boolean) as string[];
      const titles = await this.titlesFor(tx, variantIds);

      const items = input.items.map((i) =>
        tx.create(OrderItem, {
          orderId,
          variantId: i.variantId ?? null,
          title: i.title?.trim() || titles.get(i.variantId ?? '') || 'Item',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: (Number(i.unitPrice) * i.quantity).toFixed(2),
        }),
      );
      await tx.save(OrderItem, items);

      const subtotal = items.reduce((n, i) => n + Number(i.lineTotal), 0);
      const shipping = Number(input.shippingCost ?? 0);

      order.customerName = input.customerName.trim();
      order.customerPhone = phone;
      order.governorate = governorate;
      order.address = input.address?.trim() || null;
      order.paymentMethod = input.paymentMethod ?? order.paymentMethod;
      order.notes = input.notes?.trim() || null;
      order.subtotal = subtotal.toFixed(2);
      order.shippingCost = shipping.toFixed(2);
      order.total = (subtotal + shipping).toFixed(2);
      await tx.save(order);

      await OrdersService.debitStockForOrder(tx, items, orderId);
      await this.record(tx, orderId, 'EDITED', null, order.total, user);
      return order;
    });
  }

  /**
   * Administrators may correct active states. Received returns are final;
   * cancellations after dispatch must use the received-return flow. Stock,
   * revenue reversal and any refund liability commit with the status event.
   */
  async updateStatus(user: SessionUser, orderId: string, next: OrderStatus, returned?: { reason?: string; restock?: boolean }) {
    return this.db.transaction(async (tx) => {
      const order = await tx.findOne(Order, {
        where: user.role === 'ADMIN' ? { id: orderId } : { id: orderId, assignedToId: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException(problem('notFound', 'order not found'));

      const from = order.status;
      if (from === next) return order;

      if (next === 'CANCELLED' && user.role !== 'ADMIN') throw new ForbiddenException();
      if (from === 'RETURNED') throw new BadRequestException(problem('order.returnFinal', 'a received return cannot be reopened'));
      if (next === 'CANCELLED' && ['SHIPPED', 'DELIVERED'].includes(from)) {
        throw new BadRequestException(problem('order.useReturn', 'record a received return for an order that has shipped'));
      }
      if (next === 'RETURNED') {
        if (from === 'CANCELLED' || !returned?.reason?.trim() || returned.reason.trim().length > 1000 || typeof returned.restock !== 'boolean') {
          throw new BadRequestException(problem('order.returnDetails', 'enter a return reason and choose whether received goods are sellable'));
        }
        order.returnReason = returned.reason.trim();
        order.returnRestock = returned.restock;
      }
      if (from === 'CANCELLED' && order.paymentStatus !== 'UNPAID') {
        throw new BadRequestException(problem('order.returnFinal', 'a refunded or refund-due order cannot be reopened'));
      }

      if (user.role !== 'ADMIN') {
        const allowed = ALLOWED_TRANSITIONS[from] ?? [];
        if (!allowed.includes(next)) {
          throw new BadRequestException(
            problem(
              'order.transition',
              `cannot move an order from ${from} to ${next}` +
                (allowed.length ? ` — allowed: ${allowed.join(', ')}` : ' — it is final'),
              { from, to: next },
            ),
          );
        }
      }

      order.status = next;
      await tx.save(order);
      await this.record(tx, orderId, 'STATUS_CHANGED', from, next, user);

      const wasOut = from === 'CANCELLED';
      const isOut = next === 'CANCELLED' || next === 'RETURNED';
      if (!wasOut && isOut) {
        await OrdersService.creditStockForOrder(tx, orderId, next, user.id, returned?.reason);
        if (next === 'RETURNED' && !returned?.restock) {
          const items = await tx.find(OrderItem, { where: { orderId } });
          const damaged = items.filter((i) => i.variantId).map((i) => ({
            variantId: i.variantId!, quantity: -i.quantity, reason: 'DAMAGE' as const,
            sourceType: 'order', sourceId: orderId, createdById: user.id, note: returned?.reason?.trim(),
          }));
          if (damaged.length) await tx.insert(StockMovement, damaged);
        }
        if (order.paymentStatus === 'PAID') {
          await this.finance.recordOrderReturn(tx, orderId, user.id);
          order.paymentStatus = 'REFUND_DUE';
          await tx.save(order);
          await this.record(tx, orderId, 'PAYMENT_CHANGED', 'PAID', 'REFUND_DUE', user);
        }
        if (next === 'RETURNED') {
          await tx.insert(OrderEvent, { orderId, type: 'NOTE', actorId: user.id, actorName: user.name,
            note: order.returnReason, toValue: returned?.restock ? 'RESTOCK' : 'WRITE_OFF' });
        }
      } else if (wasOut && !isOut) {
        const items = await tx.find(OrderItem, { where: { orderId } });
        await this.assertStockAvailable(tx, items.map((i) => ({ ...i, variantId: i.variantId ?? undefined })));
        await OrdersService.debitStockForOrderId(tx, orderId, 'order reactivated — stock leaves again');
      }
      return order;
    });
  }

  /** Cash collection/refund is independent of whether goods were returned. */
  async updatePayment(user: SessionUser, orderId: string, next: PaymentStatus) {
    return this.db.transaction(async (tx) => {
      const order = await tx.findOne(Order, {
        where: user.role === 'ADMIN' ? { id: orderId } : { id: orderId, assignedToId: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException(problem('notFound', 'order not found'));

      const from = order.paymentStatus;
      if (from === next) return order;

      const inactive = order.status === 'CANCELLED' || order.status === 'RETURNED';
      if (next === 'REFUND_DUE' || (from === 'REFUND_DUE' && next !== 'REFUNDED') ||
          (inactive && next === 'PAID') || (next === 'REFUNDED' && !['PAID', 'REFUND_DUE'].includes(from)) ||
          from === 'REFUNDED') {
        throw new BadRequestException(problem('order.paymentTransition', 'this payment change is not available'));
      }
      if (from === 'REFUND_DUE') await this.finance.refundReturnedOrder(tx, orderId, user.id);
      order.paymentStatus = next;
      await tx.save(order);
      await this.record(tx, orderId, 'PAYMENT_CHANGED', from, next, user);

      // The money is only actually in hand the moment it turns PAID — not on
      // every save, and not when it's already been counted once before.
      if (next === 'PAID' && from !== 'PAID') {
        await this.finance.recordOrderPayment(tx, orderId, order.total);
      } else if (from === 'PAID' && next !== 'PAID') {
        await this.finance.reverseOrderPayment(tx, orderId, user.id);
      }
      return order;
    });
  }

  /** Counts for the orders header. Scoped the same way the list is. */
  async summary(user: SessionUser) {
    const scoped = user.role === 'ADMIN' ? '' : 'WHERE assigned_to_id = $1';
    const params = user.role === 'ADMIN' ? [] : [user.id];
    const [row] = await this.db.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE assigned_to_id IS NULL)::int AS unassigned,
              count(*) FILTER (WHERE status IN ('NEW','ASSIGNED'))::int AS "needsWork",
              count(*) FILTER (WHERE status = 'DELIVERED' AND payment_status = 'UNPAID')::int AS "deliveredUnpaid"
       FROM customer_order ${scoped}`,
      params,
    );
    return row;
  }

  private async titlesFor(tx: EntityManager, variantIds: string[]) {
    const titles = new Map<string, string>();
    if (!variantIds.length) return titles;
    const rows = await tx.query(
      `SELECT v.id, p.name, v.name AS variant_name
       FROM product_variant v JOIN product p ON p.id = v.product_id
       WHERE v.id = ANY($1)`,
      [variantIds],
    );
    for (const r of rows) {
      titles.set(r.id, r.variant_name === 'Default' ? r.name : `${r.name} — ${r.variant_name}`);
    }
    return titles;
  }

  private record(
    tx: EntityManager,
    orderId: string,
    type: OrderEvent['type'],
    fromValue: string | null,
    toValue: string | null,
    actor?: SessionUser,
  ) {
    return tx.insert(OrderEvent, {
      orderId,
      type,
      fromValue,
      toValue,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
    });
  }

  /** Resolves a channel's identifiers to one of our variants, if mapped. */
  static async resolveVariant(
    tx: EntityManager,
    channel: string,
    externalId: string,
    externalVariantId = '',
  ): Promise<string | null> {
    const listing = await tx.findOne(ChannelListing, {
      where: { channel: channel as never, externalId, externalVariantId },
      select: { variantId: true },
    });
    return listing?.variantId ?? null;
  }

  /**
   * Decrements stock for an order's resolved items at the moment the order is
   * created — the timing decision for every source (noon import, Easy Orders
   * webhook, manual/social order). An unmapped line has no variant and simply
   * moves nothing; it is still visible on the order as needing attention.
   */
  static async debitStockForOrder(
    tx: EntityManager,
    items: Array<{ variantId?: string | null; quantity: number }>,
    orderId: string,
  ): Promise<void> {
    const movements = items
      .filter((i) => i.variantId)
      .map((i) => ({
        variantId: i.variantId as string,
        quantity: -Math.abs(i.quantity),
        reason: 'SALE' as const,
        sourceType: 'order',
        sourceId: orderId,
      }));
    if (movements.length) {
      await lockStock(tx, movements.map((m) => m.variantId));
      await tx.insert(StockMovement, movements);
    }
  }

  /**
   * Reverses the debit above when an order is cancelled or returned — the
   * stock physically comes back (or was never really taken), so the ledger
   * says so explicitly rather than leaving it looking sold forever.
   */
  static async creditStockForOrder(
    tx: EntityManager,
    orderId: string,
    reason: 'CANCELLED' | 'RETURNED' | 'EDITED',
    actorId?: string,
    note?: string,
  ): Promise<void> {
    const items = await tx.find(OrderItem, { where: { orderId } });
    const movements = items
      .filter((i) => i.variantId)
      .map((i) => ({
        variantId: i.variantId as string,
        quantity: Math.abs(i.quantity),
        reason: reason === 'RETURNED' ? ('RETURN' as const) : ('ADJUSTMENT' as const),
        sourceType: 'order',
        sourceId: orderId,
        createdById: actorId ?? null,
        note: note?.trim() || (
          reason === 'RETURNED'
            ? 'order returned'
            : reason === 'EDITED'
              ? 'order edited — previous lines reversed'
              : 'order cancelled'),
      }));
    if (movements.length) {
      await lockStock(tx, movements.map((m) => m.variantId));
      await tx.insert(StockMovement, movements);
    }
  }

  /**
   * The mirror of `creditStockForOrder`: re-debits an order's existing lines.
   * Used only when an admin reverts a CANCELLED/RETURNED order back to an
   * active status — the stock that was credited back on cancellation has to
   * leave again, or it would be double-counted as both "returned" and "sold".
   */
  static async debitStockForOrderId(
    tx: EntityManager,
    orderId: string,
    note: string,
  ): Promise<void> {
    const items = await tx.find(OrderItem, { where: { orderId } });
    const movements = items
      .filter((i) => i.variantId)
      .map((i) => ({
        variantId: i.variantId as string,
        quantity: -Math.abs(i.quantity),
        reason: 'SALE' as const,
        sourceType: 'order',
        sourceId: orderId,
        note,
      }));
    if (movements.length) {
      await lockStock(tx, movements.map((m) => m.variantId));
      await tx.insert(StockMovement, movements);
    }
  }
}
