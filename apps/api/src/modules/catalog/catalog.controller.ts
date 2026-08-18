import {
  PERMISSIONS,
  listVariantsQuerySchema,
  type ListVariantsQuery,
  type ListVariantsResponse,
} from '@app/contracts';
import { Controller, Get, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ENV, type Env } from '../../config/env.js';
import { ZodValidationPipe } from '../../shared/zod-validation.pipe.js';
import { EasyOrdersCatalogImport, type ImportResult } from '../integrations/easyorders/catalog-import.service.js';
import type { AuthContext } from '../identity/auth-context.js';
import { CurrentAuth, RequirePermission } from '../identity/auth.guard.js';
import { CatalogService } from './catalog.service.js';

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly easyOrdersImport: EasyOrdersCatalogImport,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('variants')
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  listVariants(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(listVariantsQuerySchema)) query: ListVariantsQuery,
  ): Promise<ListVariantsResponse> {
    return this.catalog.listVariants(auth, query);
  }

  /** Operator-triggered pull of the EasyOrders product list into our catalog. */
  @Post('import/easyorders')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.CATALOG_WRITE)
  importFromEasyOrders(
    @CurrentAuth() auth: AuthContext,
    @Req() _req: Request,
  ): Promise<ImportResult> {
    return this.easyOrdersImport.run(auth.user.organizationId, auth.user.id);
  }
}
