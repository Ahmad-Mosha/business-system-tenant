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
}
