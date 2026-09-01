import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { SessionUser } from '../../auth/auth.guard';
import { Order } from '../../orders/order.entity';
import { OrderEvent } from '../../orders/order-event.entity';
import { BostaClient, type BostaDeliveryRaw } from './bosta.client';

export interface DeliveryTimelineStep {
  code: number;
  key: string;
  label: string;
  isDone: boolean;
  date: string | null;
  description?: string | null;
}

export interface DeliveryAttempt {
  date: string | null;
  state?: number;
  driverName?: string | null;
  driverPhone?: string | null;
  hubName?: string | null;
  succeeded?: boolean;
}

export interface ShipmentTrackingDto {
  trackingNumber: string;
  carrier: 'BOSTA';
  status: string;
  statusLabel: string;
  statusCode?: number;
  isDelayed: boolean;
  receiver: {
    name: string;
    phone: string;
    secondPhone?: string | null;
  };
  destination: {
    city?: string | null;
    zone?: string | null;
    district?: string | null;
    address?: string | null;
  };
  cod: {
    amount: number;
    currency: string;
    isCollected?: boolean;
    collectionStatus: 'UNPAID' | 'PAID' | 'PENDING';
    collectionStatusLabel: string; // 'غير مدفوع' | 'مدفوع'
    paymentMethodLabel: string; // 'الدفع عند الاستلام'
  };
  timeline: DeliveryTimelineStep[];
  attempts: {
    count: number;
    max: number;
    list: DeliveryAttempt[];
  };
  packageSpecs: {
    type?: string | null;
    typeAr?: string | null; // 'توصيل متوسطة' | 'توصيل صغيرة'
    description?: string | null;
    weight?: number | null;
  };
  allowOpenPackage: boolean;
  notes?: string | null;
  whatsAppConfirmation?: {
    isConfirmed: boolean;
    confirmedAt?: string | null;
  } | null;
  flexShipFee?: number | null;
  flexShipStatusLabel?: string | null; // 'غير مستحق بعد'
  scheduledDeliveryDate?: string | null;
  deliveredAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

@Injectable()
export class BostaService {
  private readonly log = new Logger(BostaService.name);

  constructor(
    private readonly bostaClient: BostaClient,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /**
   * Tracks a Bosta shipment live by tracking number.
   * Maps Bosta's response into Prime Market business concepts.
   */
  async track(trackingNumber: string): Promise<ShipmentTrackingDto | null> {
    const raw = await this.bostaClient.getDelivery(trackingNumber);
    if (!raw) return null;
    return this.normalizeBostaDelivery(raw);
  }

  /**
   * Lists all live Bosta shipments for Prime Market.
   * Automatically aggregates known business shipments and any order-linked shipments.
   */
  async listDeliveries(
    user: SessionUser,
    query?: { search?: string; status?: string },
  ): Promise<ShipmentTrackingDto[]> {
    // One call returns every delivery on the account, so the page costs a
    // single request rather than one per order.
    const deliveries = await this.bostaClient.listDeliveries();
    let list = deliveries
      .map((raw) => {
        try {
          return this.normalizeBostaDelivery(raw);
        } catch (e) {
          this.log.warn(`Could not read delivery ${raw.trackingNumber}: ${e}`);
          return null;
        }
      })
      .filter((r): r is ShipmentTrackingDto => r !== null);

    // A moderator sees only shipments belonging to orders assigned to them.
    // An admin sees the whole account, including shipments not yet linked to
    // an order — those still need chasing.
    if (user.role !== 'ADMIN') {
      const own = await this.db.getRepository(Order).find({
        where: { assignedToId: user.id },
        select: { trackingNumber: true },
      });
      const allowed = new Set(own.map((o) => o.trackingNumber).filter(Boolean) as string[]);
      list = list.filter((s) => allowed.has(s.trackingNumber));
    }

    if (query?.search) {
      const s = query.search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.trackingNumber.toLowerCase().includes(s) ||
          r.receiver.name.toLowerCase().includes(s) ||
          r.receiver.phone.includes(s) ||
          (r.destination.city && r.destination.city.toLowerCase().includes(s)) ||
          (r.destination.zone && r.destination.zone.toLowerCase().includes(s)) ||
          (r.destination.district && r.destination.district.toLowerCase().includes(s)),
      );
    }

    if (query?.status) {
      list = list.filter((r) => r.status === query.status);
    }

    return list;
  }

  /**
   * Gets tracking information for a specific order.
   * Enforces role security: moderators can only access their assigned orders.
   */
  async getForOrder(user: SessionUser, orderId: string): Promise<ShipmentTrackingDto | null> {
    const order = await this.getOrderWithAccessCheck(user, orderId);
    if (!order.trackingNumber) return null;

    try {
      return await this.track(order.trackingNumber);
    } catch (e) {
      this.log.warn(`Could not fetch live Bosta tracking for order ${order.orderNumber} (${order.trackingNumber}): ${e}`);
      return null;
    }
  }

  /**
   * Sets or clears the tracking number on an order.
   * Moderators can only update orders assigned to them; Admins can update any.
   */
  async updateOrderTracking(
    user: SessionUser,
    orderId: string,
    trackingNumber: string | null,
  ): Promise<{ orderId: string; trackingNumber: string | null; tracking: ShipmentTrackingDto | null }> {
    const orderRepo = this.db.getRepository(Order);
    const order = await this.getOrderWithAccessCheck(user, orderId);

    const cleanTn = trackingNumber?.trim() || null;
    const previousTn = order.trackingNumber;

    let trackingData: ShipmentTrackingDto | null = null;
    if (cleanTn) {
      // Validate that the tracking number exists in Bosta
      trackingData = await this.track(cleanTn);
      if (!trackingData) {
        throw new BadRequestException(`Shipment not found on Bosta with tracking number: ${cleanTn}`);
      }
    }

    order.trackingNumber = cleanTn;
    await orderRepo.save(order);

    await this.db.getRepository(OrderEvent).insert({
      orderId: order.id,
      type: 'NOTE',
      fromValue: previousTn,
      toValue: cleanTn,
      note: cleanTn
        ? `Bosta tracking number linked: ${cleanTn}`
        : 'Tracking number removed',
      actorId: user.id,
      actorName: user.name,
    });

    return {
      orderId: order.id,
      trackingNumber: cleanTn,
      tracking: trackingData,
    };
  }

  private async getOrderWithAccessCheck(user: SessionUser, orderId: string): Promise<Order> {
    const order = await this.db.getRepository(Order).findOne({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (user.role === 'MODERATOR' && order.assignedToId !== user.id) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  /**
   * Normalizes raw Bosta delivery JSON into Prime Market domain DTO.
   */
  normalizeBostaDelivery(raw: BostaDeliveryRaw): ShipmentTrackingDto {
    const stateValue = raw.state?.value || raw.maskedState || 'New';
    const statusCode = raw.state?.code ?? 10;

    const normalizedStatus = this.mapBostaStatus(
      stateValue,
      statusCode,
      raw.type?.value,
      raw.pendingPickup,
    );
    const timeline = this.buildTimeline(raw);
    const attempts = this.buildAttempts(raw);

    const receiverName =
      raw.receiver?.fullName ||
      [raw.receiver?.firstName, raw.receiver?.lastName].filter(Boolean).join(' ') ||
      'Customer';

    const city = raw.dropOffAddress?.city?.nameAr || raw.dropOffAddress?.city?.name || null;
    const zone = raw.dropOffAddress?.zone?.nameAr || raw.dropOffAddress?.zone?.name || null;
    const district = raw.dropOffAddress?.district?.nameAr || raw.dropOffAddress?.district?.name || null;
    const address = raw.dropOffAddress?.firstLine || null;

    const codAmount = Number(raw.cod ?? raw.wallet?.cashCycle?.cod ?? 0);
    // The real "has Bosta paid us" signal — verified against Bosta's own
    // dashboard on real deliveries, not guessed from the delivery status.
    // Delivered does NOT mean collected: two real شحنات with the same 510 EGP
    // COD, both Delivered, showed different collection states there, and the
    // difference tracked `cashoutInfo` exactly — not `state`, not
    // `wallet.cashCycle.deposited_at` (which was present on the one Bosta
    // still marked unpaid). No `cashoutInfo` at all = nothing computed yet;
    // present without a transaction id = a payout is scheduled, not run; a
    // real `oracleTransactionId` = an actual payout executed.
    const isPaidOut = !!raw.cashoutInfo?.oracleTransactionId;
    const hasCashoutRecord = !!raw.cashoutInfo;

    const flexShipFee = raw.flexShippingInfo?.isOrderEligible
      ? Number(raw.flexShippingInfo.amountToBeCollected ?? 0)
      : null;

    const whatsAppAction = raw.whatsAppLastMileActions?.consigneeConfirmedDelivery;
    const whatsAppConfirmation = whatsAppAction?.isConfirmedDelivery
      ? {
          isConfirmed: true,
          confirmedAt: whatsAppAction.time || null,
        }
      : null;

    const deliveredAt =
      raw.state?.deliveryTime ||
      (statusCode === 45 && raw.updatedAt ? raw.updatedAt : null);

    // codAmount === 0 is NOT automatically "paid" — a real returned shipment
    // with nothing to collect still shows غير مدفوع on Bosta's dashboard, not
    // a trivial paid/N-A. Only an executed payout counts as paid.
    const collectionStatus: 'UNPAID' | 'PAID' | 'PENDING' = isPaidOut
      ? 'PAID'
      : hasCashoutRecord
        ? 'UNPAID'
        : 'PENDING';
    // PENDING = Bosta hasn't computed a cashout for this shipment yet (it isn't
    // delivered, or the payout run hasn't happened). Bosta's dashboard labels
    // that column "قيد التنفيذ".
    const collectionStatusLabel =
      collectionStatus === 'PAID' ? 'مدفوع' : collectionStatus === 'UNPAID' ? 'غير مدفوع' : 'قيد التنفيذ';

    const pType = raw.specs?.packageType || '';
    const typeAr =
      pType.toLowerCase().includes('small')
        ? 'توصيل صغيرة'
        : pType.toLowerCase().includes('medium') || pType.toLowerCase().includes('light')
          ? 'توصيل متوسطة'
          : pType
            ? `توصيل ${pType}`
            : 'توصيل';

    return {
      trackingNumber: raw.trackingNumber || '',
      carrier: 'BOSTA',
      status: normalizedStatus.key,
      statusLabel: normalizedStatus.label,
      statusCode,
      isDelayed: Boolean(raw.isDelayed),
      receiver: {
        name: receiverName,
        phone: raw.receiver?.phone || '',
        secondPhone: raw.receiver?.secondPhone || null,
      },
      destination: {
        city,
        zone,
        district,
        address,
      },
      cod: {
        amount: codAmount,
        currency: 'EGP',
        isCollected: isPaidOut,
        collectionStatus,
        collectionStatusLabel,
        paymentMethodLabel: 'الدفع عند الاستلام',
      },
      timeline,
      attempts,
      packageSpecs: {
        type: raw.specs?.packageType || null,
        typeAr,
        description: raw.specs?.packageDetails?.description || null,
        weight: raw.specs?.weight || null,
      },
      allowOpenPackage: Boolean(raw.allowToOpenPackage),
      notes: raw.notes || null,
      whatsAppConfirmation,
      flexShipFee,
      flexShipStatusLabel: flexShipFee != null ? 'غير مستحق بعد' : 'غير مُطبَّق',
      scheduledDeliveryDate: raw.scheduledDate || raw.nextWorkingDayAfterScheduledAt || raw.promisedDate || null,
      deliveredAt,
      createdAt: raw.createdAt || null,
      updatedAt: raw.updatedAt || null,
    };
  }

  /**
   * Bosta's API only ever sends the delivery state in English (`state.value` /
   * `state.code`); the Arabic on its dashboard is its own front-end
   * translation. This is the same translation, keyed on our normalised status.
   * A state we don't recognise falls back to Bosta's raw English text rather
   * than a guessed Arabic label.
   */
  private static readonly STATUS_LABEL_AR: Record<string, string> = {
    NEW: 'جديد',
    AWAITING_PICKUP: 'في انتظار الاستلام',
    PICKED_UP: 'تم الاستلام',
    IN_TRANSIT: 'في الطريق',
    OUT_FOR_DELIVERY: 'خرج للتوصيل',
    DELIVERED: 'تم التوصيل',
    RETURNED: 'مُرتجع',
    CANCELLED: 'ملغى',
  };

  private mapBostaStatus(
    stateValue: string,
    code: number,
    typeValue?: string,
    pendingPickup?: string | null,
  ): { key: string; label: string } {
    const val = stateValue.toLowerCase();
    const at = (key: string) => ({
      key,
      label: BostaService.STATUS_LABEL_AR[key] ?? stateValue,
    });

    // The direction (forward delivery vs. return-to-origin) lives in `type`,
    // not `state` — Bosta reuses the "Delivered" state label for a package
    // delivered *back* to us. Checked first, or a real return (real example:
    // cod 0, type "Return to Origin", state "Delivered") reads as a normal
    // successful sale instead of تم الاسترجاع.
    if ((typeValue ?? '').toLowerCase().includes('return')) {
      return at('RETURNED');
    }
    if (code === 45 || (val.includes('deliver') && !val.includes('out') && !val.includes('failed'))) {
      return at('DELIVERED');
    }
    if (code === 41 || val.includes('out for delivery') || val.includes('delivering')) {
      return at('OUT_FOR_DELIVERY');
    }
    if (code === 30 || val.includes('transit') || val.includes('received at warehouse') || val.includes('hub')) {
      return at('IN_TRANSIT');
    }
    // `code === 10` covers "Pickup requested" / "Awaiting pickup" — a brand-new
    // shipment the courier has NOT collected yet. Must be checked before the
    // picked-up branch, and that branch must not match the word "pickup" alone
    // (it appears in "Pickup requested"), only the completed "picked up".
    if (code === 10 || val.includes('new') || val.includes('created') || val.includes('pickup requested') || val.includes('awaiting pickup')) {
      // Bosta splits this into "جديد" and "في انتظار الاستلام" by whether a
      // pickup has actually been requested — `pendingPickup` is that timestamp.
      return at(pendingPickup ? 'AWAITING_PICKUP' : 'NEW');
    }
    if (code === 21 || val.includes('picked up')) {
      return at('PICKED_UP');
    }
    if (val.includes('return') || val.includes('rto')) {
      return at('RETURNED');
    }
    if (val.includes('cancel')) {
      return at('CANCELLED');
    }
    if (val.includes('fail') || val.includes('exception') || val.includes('delayed')) {
      return { key: 'EXCEPTION', label: stateValue || 'Exception' };
    }
    return { key: 'IN_TRANSIT', label: stateValue || 'In Progress' };
  }

  private buildTimeline(raw: BostaDeliveryRaw): DeliveryTimelineStep[] {
    const rawTimeline = raw.timeline ?? [];
    const maxCode = raw.state?.code ?? 10;

    const standardSteps: Array<{ code: number; key: string; label: string }> = [
      { code: 10, key: 'NEW', label: 'Created' },
      { code: 21, key: 'PICKED_UP', label: 'Picked Up' },
      { code: 30, key: 'IN_TRANSIT', label: 'In Transit' },
      { code: 41, key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
      { code: 45, key: 'DELIVERED', label: 'Delivered' },
    ];

    return standardSteps.map((step) => {
      const match = rawTimeline.find((t) => t.code === step.code || t.value?.toLowerCase() === step.key.toLowerCase());
      const isDone = match?.done ?? (maxCode >= step.code);
      let date: string | null = match?.date || null;

      if (!date) {
        if (step.code === 10) date = raw.createdAt || null;
        if (step.code === 21) date = raw.state?.pickedUpTime || null;
        if (step.code === 30) date = raw.state?.receivedAtWarehouse?.time || null;
        if (step.code === 41) date = raw.state?.delivering?.time || null;
        if (step.code === 45) date = raw.state?.deliveryTime || null;
      }

      return {
        code: step.code,
        key: step.key,
        label: step.label,
        isDone,
        date,
        description: match?.desc || null,
      };
    });
  }

  private buildAttempts(raw: BostaDeliveryRaw): {
    count: number;
    max: number;
    list: DeliveryAttempt[];
  } {
    const rawList = raw.attempts ?? [];
    const count = raw.numberOfAttempts ?? rawList.length ?? (raw.state?.code && raw.state.code >= 41 ? 1 : 0);
    const max = 3;

    const list: DeliveryAttempt[] = rawList.map((a) => ({
      date: a.attemptDate || null,
      state: a.state,
      driverName: a.star?.name || null,
      driverPhone: a.star?.phone || null,
      hubName: a.warehouse?.name || null,
      succeeded: Boolean(a.succeededAt),
    }));

    return {
      count,
      max,
      list,
    };
  }
}
