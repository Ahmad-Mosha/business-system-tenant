import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import type { StockReason } from '../inventory/stock-movement.entity';
import { CatalogService, type CreateProductInput } from './catalog.service';

const REASONS: StockReason[] = ['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'COUNT'];

/**
 * Inventory is an admin responsibility, with one exception: moderators need to
 * look products up to build a manual order.
 */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Open to both roles — the manual order form needs it. */
  @Get('variants/search')
  searchVariants(@Query('q') q?: string) {
    return this.catalog.searchVariants((q ?? '').trim());
  }

  @Roles('ADMIN')
  @Get('products')
  listProducts(
    @Query('search') search?: string,
    @Query('channel') channel?: string,
    @Query('category') category?: string,
    @Query('stock') stock?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.catalog.listProducts({
      search: search?.trim() || undefined,
      channel: channel?.trim() || undefined,
      category: category?.trim() || undefined,
      stock: stock?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Roles('ADMIN')
  @Get('products/:id')
  getProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getProduct(id);
  }

  @Roles('ADMIN')
  @Post('products')
  createProduct(@Req() req: Request, @Body() body: CreateProductInput) {
    return this.catalog.createProduct(body, req.user!.id);
  }

  @Roles('ADMIN')
  @Patch('variants/:id')
  updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { sku?: string | null; unitCost?: string | null; sellingPrice?: string | null; name?: string },
  ) {
    return this.catalog.updateVariant(id, body);
  }

  @Roles('ADMIN')
  @Post('variants/:id/stock')
  recordStock(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { quantity: number; reason: StockReason; note?: string },
  ) {
    if (!REASONS.includes(body?.reason)) {
      throw new BadRequestException(`reason must be one of: ${REASONS.join(', ')}`);
    }
    return this.catalog.recordStock(id, Number(body.quantity), body.reason, req.user!.id, body.note);
  }

  @Roles('ADMIN')
  @Get('variants/:id/stock')
  stockHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.stockHistory(id);
  }

  /** Pulls the live Easy Orders catalogue so website orders can resolve. */
  @Roles('ADMIN')
  @Post('sync/easyorders')
  sync() {
    const key = process.env.easyorder_api_key ?? process.env.EASYORDERS_API_KEY;
    if (!key) throw new BadRequestException('easyorder_api_key is not configured');
    return this.catalog.syncEasyOrders(key);
  }
}
