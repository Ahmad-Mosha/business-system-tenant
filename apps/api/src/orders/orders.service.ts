import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { SessionUser } from '../auth/auth.guard';
import { ChannelListing } from '../catalog/channel-listing.entity';
import { OrderEvent } from './order-event.entity';
import { OrderItem } from './order-item.entity';
import {
  ALLOWED_TRANSITIONS,
  Order,
  type OrderStatus,
  type PaymentStatus,
} from './order.entity';

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
  constructor(@InjectDataSource() private readonly db: DataSource) {}

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
    if (!order) throw new NotFoundException('order not found');

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
    if (!input.customerName?.trim()) throw new BadRequestException('customer name is required');
    if (!input.customerPhone?.trim()) throw new BadRequestException('customer phone is required');
    if (!input.items?.length) throw new BadRequestException('an order needs at least one item');

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException('every item needs a whole quantity of at least 1');
      }
      if (!/^\d+(\.\d{1,2})?$/.test(item.unitPrice ?? '')) {
        throw new BadRequestException('every item needs a valid price');
      }
    }

    return this.db.transaction(async (tx) => {
      const variantIds = input.items.map((i) => i.variantId).filter(Boolean) as string[];
      const titles = await this.titlesFor(tx, variantIds);

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
        externalId: '',
        // A moderator creating an order already owns it.
        status: user.role === 'MODERATOR' ? ('ASSIGNED' as const) : ('NEW' as const),
        assignedToId: user.role === 'MODERATOR' ? user.id : null,
        createdById: user.id,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        governorate: input.governorate?.trim() || null,
        address: input.address?.trim() || null,
        paymentMethod: input.paymentMethod ?? 'COD',
        notes: input.notes?.trim() || null,
        subtotal: subtotal.toFixed(2),
        shippingCost: shipping.toFixed(2),
        total: (subtotal + shipping).toFixed(2),
        items,
      });

      await this.record(tx, order.id, 'CREATED', null, 'SOCIAL', user);
      return order;
    });
  }

  async assign(orderId: string, assigneeId: string | null, actor: SessionUser) {
    const repo = this.db.getRepository(Order);
    const order = await repo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('order not found');

    order.assignedToId = assigneeId;
    // Assigning an untouched order moves it along; a later state is left alone.
    if (assigneeId && order.status === 'NEW') order.status = 'ASSIGNED';
    if (!assigneeId && order.status === 'ASSIGNED') order.status = 'NEW';
    await repo.save(order);

    await this.record(this.db.manager, orderId, 'ASSIGNED', null, assigneeId ?? 'unassigned', actor);
    return order;
  }

  async updateStatus(user: SessionUser, orderId: string, next: OrderStatus) {
    const repo = this.db.getRepository(Order);
    const order = await repo.findOne({
      where: user.role === 'ADMIN' ? { id: orderId } : { id: orderId, assignedToId: user.id },
    });
    if (!order) throw new NotFoundException('order not found');

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `cannot move an order from ${order.status} to ${next}` +
          (allowed.length ? ` — allowed: ${allowed.join(', ')}` : ' — it is final'),
      );
    }

    const from = order.status;
    order.status = next;
    await repo.save(order);
    await this.record(this.db.manager, orderId, 'STATUS_CHANGED', from, next, user);
    return order;
  }

  async updatePayment(user: SessionUser, orderId: string, next: PaymentStatus) {
    const repo = this.db.getRepository(Order);
    const order = await repo.findOne({
      where: user.role === 'ADMIN' ? { id: orderId } : { id: orderId, assignedToId: user.id },
    });
    if (!order) throw new NotFoundException('order not found');

    const from = order.paymentStatus;
    order.paymentStatus = next;
    await repo.save(order);
    await this.record(this.db.manager, orderId, 'PAYMENT_CHANGED', from, next, user);
    return order;
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
}
