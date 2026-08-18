import {
  PERMISSIONS,
  listOrdersQuerySchema,
  type ListOrdersQuery,
  type ListOrdersResponse,
} from '@app/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../shared/zod-validation.pipe.js';
import type { AuthContext } from '../identity/auth-context.js';
import { CurrentAuth, RequirePermission } from '../identity/auth.guard.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ORDER_READ)
  list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ListOrdersQuery,
  ): Promise<ListOrdersResponse> {
    return this.orders.list(auth, query);
  }
}
