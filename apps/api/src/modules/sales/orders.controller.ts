import {
  PERMISSIONS,
  assignOrderRequestSchema,
  createOrderRequestSchema,
  listOrdersQuerySchema,
  updateOrderStatusRequestSchema,
  type AssignOrderRequest,
  type AssignableUser,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type ListOrdersQuery,
  type ListOrdersResponse,
  type OrderDetail,
  type UpdateOrderStatusRequest,
} from '@app/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../shared/zod-validation.pipe.js';
import type { AuthContext } from '../identity/auth-context.js';
import { CurrentAuth, RequirePermission } from '../identity/auth.guard.js';
import { CreateOrderService } from './create-order.service.js';
import { OrderDetailService } from './order-detail.service.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly details: OrderDetailService,
    private readonly creation: CreateOrderService,
  ) {}

  @Post()
  @RequirePermission(PERMISSIONS.ORDER_CREATE)
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createOrderRequestSchema)) body: CreateOrderRequest,
    @Req() req: Request,
  ): Promise<CreateOrderResponse> {
    return this.creation.create(auth, body, req.correlationId);
  }

  @Get()
  @RequirePermission(PERMISSIONS.ORDER_READ)
  list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ListOrdersQuery,
  ): Promise<ListOrdersResponse> {
    return this.orders.list(auth, query);
  }

  /** Who an admin may assign an order to. Declared before :id so it is not shadowed. */
  @Get('assignable-users')
  @RequirePermission(PERMISSIONS.USER_READ)
  assignableUsers(@CurrentAuth() auth: AuthContext): Promise<AssignableUser[]> {
    return this.details.listAssignable(auth);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ORDER_READ)
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDetail> {
    return this.details.get(auth, id);
  }

  @Post(':id/assign')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.ORDER_ASSIGN)
  async assign(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assignOrderRequestSchema)) body: AssignOrderRequest,
    @Req() req: Request,
  ): Promise<void> {
    await this.details.assign(auth, id, body.assigneeId, req.correlationId);
  }

  @Post(':id/status')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.ORDER_UPDATE_STATUS)
  async updateStatus(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateOrderStatusRequestSchema)) body: UpdateOrderStatusRequest,
    @Req() req: Request,
  ): Promise<void> {
    await this.details.updateStatus(auth, id, body.status, body.note, req.correlationId);
  }
}
