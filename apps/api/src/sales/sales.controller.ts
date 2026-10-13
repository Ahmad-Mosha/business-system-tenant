import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { SalesService, type SalesInvoiceInput } from './sales.service';

@Roles('ADMIN')
@Controller('customers')
export class CustomersController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.sales.listCustomers(status === 'archived');
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.customerDetail(id);
  }

  @Post()
  create(@Body() body: { name?: string; phone?: string; note?: string }) {
    return this.sales.createCustomer(body ?? {});
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name?: string; phone?: string | null; note?: string | null; active?: boolean },
  ) {
    return this.sales.updateCustomer(id, body ?? {});
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.sales.deleteCustomer(id);
  }
}

@Roles('ADMIN')
@Controller('sales-invoices')
export class SalesInvoicesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list() {
    return this.sales.listInvoices();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.getInvoice(id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: SalesInvoiceInput) {
    return this.sales.createDraft(body ?? ({} as SalesInvoiceInput), req.user!.id);
  }

  /** Rewrites a draft; refused once posted. */
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: SalesInvoiceInput) {
    return this.sales.updateDraft(id, body ?? ({} as SalesInvoiceInput));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.sales.deleteDraft(id);
  }

  /** The one moment a sales invoice moves stock and money. */
  @Post(':id/post')
  post(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { paidNow?: string }) {
    return this.sales.postInvoice(id, body?.paidNow, req.user!.id);
  }

  @Post(':id/payments')
  pay(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { amount?: string; memo?: string }) {
    return this.sales.recordPayment(id, body?.amount ?? '', body?.memo, req.user!.id);
  }

  @Post(':id/payments/:entryId/reverse')
  reversePayment(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.sales.reversePayment(id, entryId, req.user!.id);
  }

  @Post(':id/void')
  void(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.sales.voidInvoice(id, body?.reason ?? '', req.user!.id);
  }
}
