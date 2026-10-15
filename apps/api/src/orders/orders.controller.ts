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
const ALL_PAYMENT_STATUSES: PaymentStatus[] = [...PAYMENT_STATUSES, 'REFUND_DUE'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `status` takes one status or several, comma-separated: `NEW,ASSIGNED`. */
function filtersOf(q: Record<string, string | undefined>) {
  const status = q.status ? (q.status.split(',') as OrderStatus[]) : undefined;
  if (status?.some((s) => !STATUSES.includes(s))) throw new BadRequestException('unknown status');
  const paymentStatus = q.paymentStatus as PaymentStatus | undefined;
  if (paymentStatus && !ALL_PAYMENT_STATUSES.includes(paymentStatus)) throw new BadRequestException('unknown payment status');
  if (q.assignedToId && !UUID.test(q.assignedToId)) throw new BadRequestException('unknown assignee');
  return {
    status,
    paymentStatus,
    source: q.source || undefined,
    assignedToId: q.assignedToId,
    unassigned: q.unassigned === 'true',
    search: q.search?.trim() || undefined,
  };
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** The session user is set by the global auth guard. */
  private user(req: Request): SessionUser {
    return req.user as SessionUser;
  }

  @Get()
  list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    return this.orders.list(this.user(req), {
      ...filtersOf(query),
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
  }

  /** The header figures and per-status counts, for the same filters as the list. */
  @Get('summary')
  summary(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    return this.orders.summary(this.user(req), filtersOf(query));
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

  /** Assigns the visible selection atomically; never leaves half the rows changed. */
  @Roles('ADMIN')
  @Patch('assignment/bulk')
  bulkAssign(
    @Req() req: Request,
    @Body() body: { orderIds?: string[]; assignedToId?: string | null },
  ) {
    return this.orders.bulkAssign(body?.orderIds ?? [], body?.assignedToId ?? null, this.user(req));
  }

  /** Deliberately open to both roles — moderators move their own orders. */
  @Patch(':id/status')
  updateStatus(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: OrderStatus; reason?: string; restock?: boolean },
  ) {
    if (!STATUSES.includes(body?.status)) throw new BadRequestException('unknown status');
    return this.orders.updateStatus(this.user(req), id, body.status, body);
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
