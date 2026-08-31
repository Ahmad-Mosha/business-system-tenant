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
import type { SessionUser } from '../auth/auth.guard';
import { ALLOWED_TRANSITIONS, type OrderStatus, type PaymentStatus } from './order.entity';
import { OrdersService, type CreateOrderInput } from './orders.service';

const STATUSES = Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[];
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PAID', 'REFUNDED'];

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** The session user is set by the global auth guard. */
  private user(req: Request): SessionUser {
    return req.user as SessionUser;
  }

  @Get()
  list(
    @Req() req: Request,
    @Query('status') status?: OrderStatus,
    @Query('source') source?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('unassigned') unassigned?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (status && !STATUSES.includes(status)) throw new BadRequestException('unknown status');
    return this.orders.list(this.user(req), {
      status,
      source,
      assignedToId,
      unassigned: unassigned === 'true',
      search: search?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('summary')
  summary(@Req() req: Request) {
    return this.orders.summary(this.user(req));
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(this.user(req), id);
  }

  /** Both roles create manual orders; a moderator's is assigned to them. */
  @Post()
  create(@Req() req: Request, @Body() body: CreateOrderInput) {
    return this.orders.create(this.user(req), body);
  }

  /** Both roles edit; a moderator only the orders assigned to them. */
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateOrderInput,
  ) {
    return this.orders.update(this.user(req), id, body);
  }

  /** Assignment is an admin responsibility. */
  @Roles('ADMIN')
  @Patch(':id/assignment')
  assign(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { assignedToId: string | null },
  ) {
    return this.orders.assign(id, body?.assignedToId ?? null, this.user(req));
  }

  /** Deliberately open to both roles — moderators move their own orders. */
  @Patch(':id/status')
  updateStatus(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: OrderStatus },
  ) {
    if (!STATUSES.includes(body?.status)) throw new BadRequestException('unknown status');
    return this.orders.updateStatus(this.user(req), id, body.status);
  }

  @Patch(':id/payment')
  updatePayment(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { paymentStatus: PaymentStatus },
  ) {
    if (!PAYMENT_STATUSES.includes(body?.paymentStatus)) {
      throw new BadRequestException('unknown payment status');
    }
    return this.orders.updatePayment(this.user(req), id, body.paymentStatus);
  }
}
