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
  /**
   * The real signal for "has Bosta actually paid us." Absent = nothing
   * computed yet; present without `oracleTransactionId` = a payout is
   * scheduled but hasn't run; `oracleTransactionId` present = an actual
   * accounting transaction executed. Verified against Bosta's own dashboard
   * ("حالة المبلغ المحصل") on real deliveries — `wallet.cashCycle.deposited_at`
   * does *not* mean paid; a delivery can have it set and still show unpaid.
   */
  cashoutInfo?: {
    expectedCashoutDate?: string;
    oracleTransactionId?: string;
  } | null;
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
  /**
   * Set (to a timestamp) once a pickup has actually been requested for a
   * still-unpicked shipment. This is what Bosta's dashboard uses to split
   * "جديد" (absent) from "في انتظار الاستلام" (present).
   */
  pendingPickup?: string | null;
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

/** Bosta can be slow; a hung request must not hold a page load open. */
const REQUEST_TIMEOUT_MS = 8000;

/** Bosta's delivery-search page size; 100 is the largest it honours. */
const SEARCH_PAGE_SIZE = 100;

/**
 * Pulls pages from `fetchPage` (1-indexed) until one comes back shorter than
 * `pageSize`. `maxPages` is a hard stop so a misbehaving endpoint can't loop
 * forever — 50 × 100 = 5000 deliveries.
 * ponytail: fetches all history every call. Add a date filter to the search
 * body once the account has thousands of deliveries and this gets slow.
 */
export async function collectPages<T>(
  pageSize: number,
  fetchPage: (page: number) => Promise<T[]>,
  maxPages = 50,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await fetchPage(page);
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

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

  private readonly searchUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('BOSTA_KEY') ?? process.env.BOSTA_KEY ?? '';
    this.baseUrl = (
      this.config.get<string>('BOSTA_BASE_URL') ??
      process.env.BOSTA_BASE_URL ??
      'https://api.bosta.co/api/v1'
    ).replace(/\/+$/, '');
    // `POST /api/v2/deliveries/search` is the only working list endpoint (see
    // `search` below); derive it from whatever host/version the base URL names.
    this.searchUrl = `${this.baseUrl.replace(/\/api\/v\d+$/, '')}/api/v2/deliveries/search`;
  }

  /**
   * One page of `POST /api/v2/deliveries/search` — the only Bosta endpoint that
   * lists deliveries with real pagination *and* carries `cashoutInfo` (the COD
   * payout signal). The old `GET /api/v0/deliveries` silently caps every page
   * at 10 whatever `limit` says; `GET /api/v1/deliveries/{tn}` returns
   * `cashoutInfo: null` for everyone, so its collection state is useless.
   * The response's `count` is unreliable (often 0) — callers page until a
   * short page instead.
   */
  private async search(body: Record<string, unknown>): Promise<BostaDeliveryRaw[]> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = this.apiKey;

    try {
      const res = await fetch(this.searchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.log.error(`Bosta search error [${res.status}]`);
        throw new Error(`Bosta API error: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { data?: { deliveries?: BostaDeliveryRaw[] } };
      return json?.data?.deliveries ?? [];
    } catch (e) {
      if (e instanceof Error && e.name === 'TimeoutError') {
        throw new Error(`Bosta did not respond within ${REQUEST_TIMEOUT_MS}ms`);
      }
      throw e;
    }
  }

  /** Every delivery on the business account, all pages. */
  async listDeliveries(): Promise<BostaDeliveryRaw[]> {
    const deliveries = await collectPages(SEARCH_PAGE_SIZE, (page) =>
      this.search({ limit: SEARCH_PAGE_SIZE, page }),
    );

    // Warm the per-AWB cache so opening one costs nothing.
    for (const d of deliveries) {
      if (d.trackingNumber) this.cache.set(d.trackingNumber, { at: Date.now(), value: d });
    }
    return deliveries;
  }

  /**
   * One delivery by tracking number — the same object shape as
   * {@link listDeliveries}, so the shipments list and a single-tracking
   * refresh can never disagree about status or COD collection.
   */
  async getDelivery(trackingNumber: string): Promise<BostaDeliveryRaw | null> {
    const cleanTn = (trackingNumber ?? '').trim();
    if (!cleanTn) {
      throw new Error('tracking number is required');
    }

    const cached = this.cache.get(cleanTn);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

    const [hit] = await this.search({ trackingNumbers: [cleanTn] });
    const value = hit ?? null;
    // Cache a miss too, so a wrong tracking number is not re-asked every render.
    this.cache.set(cleanTn, { at: Date.now(), value });
    return value;
  }
}
