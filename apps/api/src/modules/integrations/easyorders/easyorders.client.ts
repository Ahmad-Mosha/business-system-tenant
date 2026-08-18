import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env.js';
import { DomainError } from '../../../shared/errors.js';
import { rootLogger } from '../../../shared/logger.js';
import { easyOrdersProductListSchema, type EasyOrdersProduct } from './easyorders.types.js';

export class IntegrationUnavailableError extends DomainError {
  constructor(provider: string) {
    super(
      'INTEGRATION_UNAVAILABLE',
      `${provider} is not configured on this environment`,
      503,
    );
  }
}

export class IntegrationRequestError extends DomainError {
  constructor(provider: string, detail: string) {
    super('INTEGRATION_REQUEST_FAILED', `${provider}: ${detail}`, 502);
  }
}

/**
 * Thin HTTP client for the EasyOrders public API.
 *
 * Documented limits that shape everything above this class:
 *  - 40 requests per minute
 *  - there is NO list-orders endpoint; orders arrive by webhook only
 */
@Injectable()
export class EasyOrdersClient {
  private readonly log = rootLogger.child({ integration: 'easyorders' });

  constructor(@Inject(ENV) private readonly env: Env) {}

  get configured(): boolean {
    return Boolean(this.env.EASY_ORDER_KEY);
  }

  async listProducts(): Promise<EasyOrdersProduct[]> {
    const body = await this.request('/products');
    const parsed = easyOrdersProductListSchema.safeParse(body);
    if (!parsed.success) {
      // A shape change must fail loudly here rather than silently import nothing.
      this.log.error({ issues: parsed.error.issues.slice(0, 5) }, 'Unexpected product shape');
      throw new IntegrationRequestError('EasyOrders', 'product response did not match the expected shape');
    }
    return parsed.data;
  }

  /** Fetches the authoritative view of one order. Webhooks only tell us to call this. */
  async getOrder(externalId: string): Promise<unknown> {
    return this.request(`/orders/${encodeURIComponent(externalId)}`);
  }

  private async request(path: string): Promise<unknown> {
    const key = this.env.EASY_ORDER_KEY;
    if (!key) throw new IntegrationUnavailableError('EasyOrders');

    let res: Response;
    try {
      res = await fetch(`${this.env.EASY_ORDER_BASE_URL}${path}`, {
        headers: { 'Api-Key': key, accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'network error';
      this.log.error({ path, detail }, 'Request failed');
      throw new IntegrationRequestError('EasyOrders', detail);
    }

    if (res.status === 429) {
      throw new IntegrationRequestError('EasyOrders', 'rate limited (40 requests/minute)');
    }
    if (!res.ok) {
      this.log.error({ path, status: res.status }, 'Non-OK response');
      throw new IntegrationRequestError('EasyOrders', `responded ${res.status}`);
    }

    return res.json();
  }
}
