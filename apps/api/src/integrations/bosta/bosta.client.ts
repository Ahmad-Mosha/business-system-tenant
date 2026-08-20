import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BostaDeliveryRaw {
  _id?: string;
  trackingNumber?: string;
  state?: {
    value?: string;
    code?: number;
    childState?: string | null;
    deliveryTime?: string | null;
    pickedUpTime?: string | null;
    receivedAtWarehouse?: { time?: string | null; warehouse?: { name?: string } } | null;
    delivering?: { time?: string | null } | null;
  };
  maskedState?: string;
  type?: { code?: number; value?: string };
  cod?: number;
  isDelayed?: boolean;
  receiver?: {
    _id?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    secondPhone?: string | null;
  };
  dropOffAddress?: {
    firstLine?: string;
    city?: { name?: string; nameAr?: string };
    zone?: { name?: string; nameAr?: string };
    district?: { name?: string; nameAr?: string };
    addressClarityScore?: number;
  };
  pickupAddress?: {
    firstLine?: string;
    city?: { name?: string; nameAr?: string };
    zone?: { name?: string; nameAr?: string };
    district?: { name?: string; nameAr?: string };
    locationName?: string;
  };
  timeline?: Array<{
    value?: string;
    code?: number;
    done?: boolean;
    date?: string;
    desc?: string;
  }>;
  specs?: {
    packageType?: string;
    packageDetails?: {
      itemsCount?: number;
      description?: string;
    };
    weight?: number;
  };
  attempts?: Array<{
    _id?: string;
    attemptDate?: string;
    state?: number;
    star?: {
      name?: string;
      phone?: string;
    };
    warehouse?: {
      name?: string;
    };
    succeededAt?: string | null;
  }>;
  numberOfAttempts?: number;
  allowToOpenPackage?: boolean;
  notes?: string;
  businessReference?: string;
  createdAt?: string;
  updatedAt?: string;
  promisedDate?: string;
  scheduledDate?: string;
  nextWorkingDayAfterScheduledAt?: string;
  lastChanceToDeliverDate?: string;
  flexShippingInfo?: {
    isOrderEligible?: boolean;
    isAmountCollected?: boolean;
    amountToBeCollected?: number;
  };
  whatsAppLastMileActions?: {
    orderStatus?: string;
    consigneeConfirmedDelivery?: {
      isConfirmedDelivery?: boolean;
      time?: string;
    };
  };
  wallet?: {
    cashCycle?: {
      cod?: string | number;
      bosta_fees?: string | number;
      deposited_amt?: number;
      deposited_at?: string;
    };
  };
}

export interface BostaResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

/** Bosta can be slow; a hung request must not hold a page load open. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Shipment state changes in minutes, not milliseconds. A short cache turns a
 * shipments page that would make one call per order into at most one call per
 * order per minute.
 * ponytail: in-process map, fine for one API instance. Move to Redis if the
 * API is ever run more than once.
 */
const CACHE_TTL_MS = 60_000;

@Injectable()
export class BostaClient {
  private readonly log = new Logger(BostaClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly cache = new Map<string, { at: number; value: BostaDeliveryRaw | null }>();

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('BOSTA_KEY') ?? process.env.BOSTA_KEY ?? '';
    this.baseUrl = (
      this.config.get<string>('BOSTA_BASE_URL') ??
      process.env.BOSTA_BASE_URL ??
      'https://api.bosta.co/api/v1'
    ).replace(/\/+$/, '');
  }

  async getDelivery(trackingNumber: string): Promise<BostaDeliveryRaw | null> {
    const cleanTn = (trackingNumber ?? '').trim();
    if (!cleanTn) {
      throw new Error('tracking number is required');
    }

    const cached = this.cache.get(cleanTn);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

    const url = `${this.baseUrl}/deliveries/${encodeURIComponent(cleanTn)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = this.apiKey;
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (res.status === 404) {
        // Cache the miss too, so a wrong tracking number is not re-asked
        // on every render.
        this.cache.set(cleanTn, { at: Date.now(), value: null });
        return null;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        this.log.error(`Bosta API error [${res.status}] for ${cleanTn}: ${errText}`);
        throw new Error(`Bosta API error: ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as BostaResponse<BostaDeliveryRaw>;
      const value = json?.data ?? null;
      this.cache.set(cleanTn, { at: Date.now(), value });
      return value;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Bosta API error')) {
        throw e;
      }
      if (e instanceof Error && e.name === 'TimeoutError') {
        throw new Error(`Bosta did not respond within ${REQUEST_TIMEOUT_MS}ms`);
      }
      this.log.error(`Failed to fetch Bosta delivery for ${cleanTn}: ${e}`);
      throw new Error(`Failed to connect to Bosta: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
