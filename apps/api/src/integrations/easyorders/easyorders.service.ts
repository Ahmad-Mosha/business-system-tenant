import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { OrderItem } from '../../orders/order-item.entity';
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
  status: 'created' | 'updated' | 'duplicate' | 'ignored';
  orderId?: string;
  orderNumber?: string;
  unmappedItems?: number;
}

@Injectable()
export class EasyOrdersService {
  private readonly log = new Logger(EasyOrdersService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Records the delivery, then tries to turn it into an order. Recording and
   * processing are separated so a processing failure still leaves the payload
   * on disk to replay.
   */
  async ingest(raw: unknown): Promise<IngestResult> {
    const fingerprint = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
    const body = raw as Partial<EasyOrdersOrder & StatusChange>;

    const isStatusChange = typeof body?.event_type === 'string' && !!body?.order_id;
    const eventType = isStatusChange ? String(body.event_type) : 'order-created';
    const externalOrderId = isStatusChange ? String(body.order_id) : (body?.id ?? null);

    const events = this.db.getRepository(EasyOrdersEvent);
    if (await events.findOneBy({ fingerprint })) {
      return { status: 'duplicate' };
    }

    const event = await events.save({
      fingerprint,
      eventType,
      externalOrderId,
      payload: raw,
      processedAt: null,
      error: null,
    });

    try {
      const result = isStatusChange
        ? await this.applyStatusChange(body as StatusChange)
        : await this.createOrder(body as EasyOrdersOrder);
      await events.update(event.id, { processedAt: new Date(), error: null });
      return result;
    } catch (e) {
      // Left unprocessed with the reason attached rather than thrown away.
      const message = e instanceof Error ? e.message : String(e);
      await events.update(event.id, { error: message });
      this.log.error(`easyorders ${eventType} ${externalOrderId}: ${message}`);
      throw e;
    }
  }

  private async createOrder(payload: EasyOrdersOrder): Promise<IngestResult> {
    if (!payload?.id) throw new Error('payload has no order id');

    // The secret is shared per webhook; this also rejects a payload that
    // belongs to a different store, so one leaked secret cannot inject orders.
    const expectedStore = process.env.EASYORDERS_STORE_ID;
    if (expectedStore && payload.store_id && payload.store_id !== expectedStore) {
      throw new BadRequestException(
        `payload belongs to store ${payload.store_id}, not ours`,
      );
    }

    return this.db.transaction(async (tx) => {
      const existing = await tx.findOne(Order, {
        where: { source: 'EASYORDERS', externalId: payload.id },
        select: { id: true, orderNumber: true },
      });
      // A redelivery with a different body still must not create a second order.
      if (existing) {
        return { status: 'duplicate' as const, orderId: existing.id, orderNumber: existing.orderNumber };
      }

      const cartItems = payload.cart_items ?? [];
      const items: OrderItem[] = [];
      let unmapped = 0;

      for (const line of cartItems) {
        const externalProductId = line.product_id ?? line.product?.id ?? null;
        const externalVariantId = line.variant_id ?? line.variant?.id ?? '';

        const variantId = externalProductId
          ? await OrdersService.resolveVariant(tx, 'easyorders', externalProductId, externalVariantId)
          : null;
        if (!variantId) unmapped++;

        const quantity = Number(line.quantity ?? 1);
        const unitPrice = Number(line.price ?? 0);
        items.push(
          tx.create(OrderItem, {
            variantId,
            externalProductId,
            externalVariantId: externalVariantId || null,
            title: line.product?.name?.trim() || 'Unnamed item',
            quantity,
            unitPrice: unitPrice.toFixed(2),
            lineTotal: (unitPrice * quantity).toFixed(2),
          }),
        );
      }

      const subtotal = Number(payload.cost ?? items.reduce((n, i) => n + Number(i.lineTotal), 0));
      const shipping = Number(payload.shipping_cost ?? 0);
      const total = Number(payload.total_cost ?? subtotal + shipping);

      const [{ nextval }] = await tx.query("SELECT nextval('order_number_seq')");

      const order = await tx.save(Order, {
        orderNumber: `PM-${nextval}`,
        source: 'EASYORDERS' as const,
        externalId: payload.id,
        status: 'NEW' as const,
        externalStatus: payload.status ?? null,
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
        placedAt: payload.created_at ? new Date(payload.created_at) : new Date(),
        items,
      });

      await OrdersService.debitStockForOrder(tx, items, order.id);

      await tx.insert(OrderEvent, {
        orderId: order.id,
        type: 'CREATED',
        toValue: 'EASYORDERS',
        note: unmapped ? `${unmapped} item(s) not matched to a product` : null,
      });

      this.log.log(`easyorders order ${payload.id} -> ${order.orderNumber} (${unmapped} unmapped)`);
      return {
        status: 'created' as const,
        orderId: order.id,
        orderNumber: order.orderNumber,
        unmappedItems: unmapped,
      };
    });
  }

  /**
   * Easy Orders' own status values are undocumented beyond `pending` and
   * `paid`, so they are recorded verbatim and only `paid` is acted on. Our
   * operational status is driven by our team, not by the website.
   */
  private async applyStatusChange(payload: StatusChange): Promise<IngestResult> {
    const repo = this.db.getRepository(Order);
    const order = await repo.findOneBy({ source: 'EASYORDERS', externalId: payload.order_id });
    if (!order) return { status: 'ignored' };

    const previous = order.externalStatus;
    order.externalStatus = payload.new_status ?? null;
    if (payload.new_status?.toLowerCase() === 'paid') order.paymentStatus = 'PAID';
    await repo.save(order);

    await this.db.getRepository(OrderEvent).insert({
      orderId: order.id,
      type: 'NOTE',
      fromValue: previous,
      toValue: payload.new_status ?? null,
      note: 'status change received from Easy Orders',
    });

    return { status: 'updated', orderId: order.id, orderNumber: order.orderNumber };
  }

  /** Deliveries that could not be turned into an order. */
  failures(tx: EntityManager = this.db.manager) {
    return tx.find(EasyOrdersEvent, {
      where: { processedAt: undefined },
      order: { receivedAt: 'DESC' },
      take: 50,
    });
  }
}
