import { Injectable } from '@nestjs/common';
import { rootLogger } from '../../../shared/logger.js';
import { AuditService } from '../../audit/audit.service.js';
import { CatalogService } from '../../catalog/catalog.service.js';
import { EasyOrdersClient } from './easyorders.client.js';

export interface ImportResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: { externalId: string; reason: string }[];
}

/**
 * Pulls the EasyOrders product list into the internal catalog.
 *
 * Import direction is one-way for now: our system is the master catalog, and this
 * exists to seed it from what already sells. It never deletes - a product missing
 * from the feed may simply have been hidden, and deleting catalog rows would orphan
 * order history.
 */
@Injectable()
export class EasyOrdersCatalogImport {
  private readonly log = rootLogger.child({ integration: 'easyorders', job: 'catalog-import' });

  constructor(
    private readonly client: EasyOrdersClient,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
  ) {}

  async run(organizationId: string, actorUserId?: string): Promise<ImportResult> {
    const products = await this.client.listProducts();
    const result: ImportResult = { fetched: products.length, created: 0, updated: 0, skipped: [] };

    for (const product of products) {
      const title = product.name?.trim();
      if (!title) {
        result.skipped.push({ externalId: product.id, reason: 'missing name' });
        continue;
      }

      // EasyOrders prices are major units; the rest of the system speaks piastres.
      const price = typeof product.price === 'number' ? Math.round(product.price * 100) : null;

      const outcome = await this.catalog.importListingAsNewProduct({
        organizationId,
        channel: 'EASYORDERS',
        externalId: product.id,
        externalSku: product.sku ?? null,
        title,
        price,
        imageUrl: product.thumb ?? null,
        description: product.description ?? null,
      });

      if (outcome.created) result.created += 1;
      else result.updated += 1;
    }

    this.log.info(result, 'Catalog import finished');
    await this.audit.record({
      actor: actorUserId
        ? { type: 'USER', userId: actorUserId, organizationId }
        : { type: 'INTEGRATION', organizationId },
      action: 'catalog.import.completed',
      data: { ...result, channel: 'EASYORDERS' },
    });

    return result;
  }
}
