import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { FinanceService } from '../../finance/finance.service';
import { OrderItem } from '../../orders/order-item.entity';
import { nextOrderNumber } from '../../orders/order-number';
import { Order } from '../../orders/order.entity';
import { OrdersService } from '../../orders/orders.service';
import { OrderEvent } from '../../orders/order-event.entity';
import { EasyOrdersEvent } from './easyorders-event.entity';

/**
 * Shape of the documented `Order Created` webhook. Only the fields we rely on
 * are declared; anything else stays in the stored raw payload.
 * https://public-api-docs.easy-orders.net/docs/webhooks
 */
interface EasyOrdersOrder {
  id: string;
  store_id?: string;
  created_at?: string;
  cost?: number;
  shipping_cost?: number;
  total_cost?: number;
  status?: string;
  full_name?: string;
  phone?: string;
  government?: string;
  address?: string;
  payment_method?: string;
  cart_items?: Array<{
    id: string;
    product_id?: string;
    variant_id?: string;
    price?: number;
    quantity?: number;
    product?: { id?: string; name?: string; sku?: string };
    variant?: { id?: string };
  }>;
}

interface StatusChange {
  event_type: string;
  order_id: string;
  old_status?: string;
  new_status?: string;
}

export interface IngestResult {
  status: 'created' | 'updated' | 'duplicate';
  orderId?: string;
  orderNumber?: string;
  unmappedItems?: number;
}

@Injectable()
export class EasyOrdersService {
  private readonly log = new Logger(EasyOrdersService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly finance: FinanceService,
  ) {}

  /**
   * Stores every delivery before processing. Deliveries for the same external
   * order share a transaction-scoped advisory lock, so concurrent redeliveries
   * and status changes cannot race each other. A failed row remains unprocessed
   * and the exact same delivery can retry it later.
   */
  async ingest(raw: unknown): Promise<IngestResult> {
    const encoded = JSON.stringify(raw) ?? 'null';
    const fingerprint = createHash('sha256').update(encoded).digest('hex');
    const body = raw as Partial<EasyOrdersOrder & StatusChange>;

    const isStatusChange = typeof body?.event_type === 'string' && !!body?.order_id;
    const eventType = isStatusChange ? String(body.event_type) : 'order-created';
    const externalOrderId = isStatusChange
      ? String(body.order_id)
      : body?.id == null ? null : String(body.id);
    const lockKey = externalOrderId ? `easyorders:order:${externalOrderId}` : `easyorders:event:${fingerprint}`;

    const events = this.db.getRepository(EasyOrdersEvent);
    await this.db.query(
      `INSERT INTO easyorders_event (fingerprint, event_type, external_order_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (fingerprint) DO NOTHING`,
      [fingerprint, eventType, externalOrderId, encoded],
    );

    try {
      return await this.db.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey]);
        const event = await tx.findOne(EasyOrdersEvent, {
          where: { fingerprint },
          lock: { mode: 'pessimistic_write' },
        });
        if (!event) throw new Error('stored Easy Orders event disappeared');
        if (event.processedAt) return { status: 'duplicate' as const };

        const result = isStatusChange
          ? await this.applyStatusChange(body as StatusChange, tx)
          : await this.createOrder(body as EasyOrdersOrder, tx);
        event.processedAt = new Date();
        event.error = null;
        await tx.save(event);
        return result;
      });
    } catch (e) {
      // The processing transaction has rolled back. Keep the original payload
      // and error for inspection, unless another retry already completed it.
      const message = e instanceof Error ? e.message : String(e);
      await events.update({ fingerprint, processedAt: IsNull() }, { error: message });
      this.log.error(`easyorders ${eventType} ${externalOrderId}: ${message}`);
      throw e;
    }
  }

  private static nonnegative(value: unknown, fallback: number, field: string): number {
    const amount = value == null ? fallback : Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > 999_999_999_999.99) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
    return amount;
  }

  private async createOrder(payload: EasyOrdersOrder, tx: EntityManager): Promise<IngestResult> {
    const externalId = String(payload?.id ?? '').trim();
    if (!externalId) throw new BadRequestException('payload has no order id');

    // The secret is shared per webhook; this also rejects a payload that
    // belongs to a different store, so one leaked secret cannot inject orders.
    const expectedStore = process.env.EASYORDERS_STORE_ID;
    if (expectedStore && payload.store_id != null && String(payload.store_id) !== expectedStore) {
      throw new BadRequestException(
        `payload belongs to store ${payload.store_id}, not ours`,
      );
    }

    const existing = await tx.findOne(Order, {
      where: { source: 'EASYORDERS', externalId },
      select: { id: true, orderNumber: true },
    });
    // A redelivery with a different body still must not create a second order.
    if (existing) {
      return { status: 'duplicate', orderId: existing.id, orderNumber: existing.orderNumber };
    }

    if (!Array.isArray(payload.cart_items) || payload.cart_items.length === 0) {
      throw new BadRequestException('order must contain at least one item');
    }
    const items: OrderItem[] = [];
    let unmapped = 0;

    for (const line of payload.cart_items) {
      if (!line || typeof line !== 'object') throw new BadRequestException('order contains an invalid item');
      const externalProductId = line.product_id ?? line.product?.id ?? null;
      const externalVariantId = line.variant_id ?? line.variant?.id ?? '';

      const variantId = externalProductId
        ? await OrdersService.resolveVariant(tx, 'easyorders', externalProductId, externalVariantId)
        : null;
      if (!variantId) unmapped++;

      const quantity = Number(line.quantity ?? 1);
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2_147_483_647) {
        throw new BadRequestException('item quantity must be a positive integer');
      }
      const unitPrice = EasyOrdersService.nonnegative(line.price, 0, 'item price');
      const lineTotal = EasyOrdersService.nonnegative(unitPrice * quantity, 0, 'line total');
      items.push(
        tx.create(OrderItem, {
          variantId,
          externalProductId,
          externalVariantId: externalVariantId || null,
          title: line.product?.name?.trim() || 'Unnamed item',
          quantity,
          unitPrice: unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        }),
      );
    }

    const itemTotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
    const subtotal = EasyOrdersService.nonnegative(payload.cost, itemTotal, 'order cost');
    const shipping = EasyOrdersService.nonnegative(payload.shipping_cost, 0, 'shipping cost');
    const total = EasyOrdersService.nonnegative(payload.total_cost, subtotal + shipping, 'total cost');
    const placedAt = payload.created_at ? new Date(payload.created_at) : new Date();
    if (Number.isNaN(placedAt.getTime())) throw new BadRequestException('created_at must be a valid date');

    const order = await tx.save(Order, {
      orderNumber: await nextOrderNumber(tx),
      source: 'EASYORDERS' as const,
      externalId,
      status: 'NEW' as const,
      externalStatus: typeof payload.status === 'string' ? payload.status : null,
      // `cod` is the only value the docs show. Rather than guess at a
      // mapping for unknown values, the raw string is kept on the event
      // payload and the order defaults to COD.
      paymentMethod: 'COD' as const,
      customerName: payload.full_name?.trim() || 'Unknown',
      customerPhone: payload.phone?.trim() || '',
      governorate: payload.government?.trim() || null,
      address: payload.address?.trim() || null,
      subtotal: subtotal.toFixed(2),
      shippingCost: shipping.toFixed(2),
      total: total.toFixed(2),
      placedAt,
      items,
    });

    await OrdersService.debitStockForOrder(tx, items, order.id);

    await tx.insert(OrderEvent, {
      orderId: order.id,
      type: 'CREATED',
      toValue: 'EASYORDERS',
      note: unmapped ? `${unmapped} item(s) not matched to a product` : null,
    });

    this.log.log(`easyorders order ${externalId} -> ${order.orderNumber} (${unmapped} unmapped)`);
    return {
      status: 'created',
      orderId: order.id,
      orderNumber: order.orderNumber,
      unmappedItems: unmapped,
    };
  }

  /**
   * Easy Orders' own status values are undocumented beyond `pending` and
   * `paid`, so they are recorded verbatim and only `paid` is acted on. Our
   * operational status is driven by our team, not by the website.
   */
  private async applyStatusChange(payload: StatusChange, tx: EntityManager): Promise<IngestResult> {
    const externalId = String(payload.order_id ?? '').trim();
    if (!externalId) throw new BadRequestException('status payload has no order id');
    const order = await tx.findOne(Order, {
      where: { source: 'EASYORDERS', externalId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) {
      throw new ConflictException('status change arrived before its order; retry this delivery');
    }

    const nextStatus = typeof payload.new_status === 'string' ? payload.new_status : null;
    const previous = order.externalStatus;
    const wasPaid = order.paymentStatus === 'PAID';
    order.externalStatus = nextStatus;
    if (nextStatus?.toLowerCase() === 'paid' && order.paymentStatus === 'UNPAID' &&
        !['CANCELLED', 'RETURNED'].includes(order.status)) order.paymentStatus = 'PAID';
    await tx.save(order);

    // Same rule as our own payment-status change: the money only lands the
    // moment it first turns PAID.
    if (order.paymentStatus === 'PAID' && !wasPaid) {
      await this.finance.recordOrderPayment(tx, order.id, order.total, order.shippingCost);
    }

    await tx.insert(OrderEvent, {
      orderId: order.id,
      type: 'NOTE',
      fromValue: previous,
      toValue: nextStatus,
      note: 'status change received from Easy Orders',
    });

    return { status: 'updated', orderId: order.id, orderNumber: order.orderNumber };
  }

  /**
   * Deliveries that could not be turned into an order: `processedAt` stays null
   * on failure (only `error` is set), so an unprocessed row is a failed one.
   */
  failures(tx: EntityManager = this.db.manager) {
    return tx.find(EasyOrdersEvent, {
      where: { processedAt: IsNull() },
      order: { receivedAt: 'DESC' },
      take: 50,
    });
  }
}
