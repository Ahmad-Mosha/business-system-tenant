import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import type { CostAllocation, PurchasePayment } from './purchase-invoice.entity';
import { PurchasingService, type InvoiceLineInput } from './purchasing.service';

@Roles('ADMIN')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get()
  list() {
    return this.purchasing.listSuppliers();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasing.supplierDetail(id);
  }

  @Post()
  create(@Body() body: { name?: string; phone?: string; note?: string }) {
    return this.purchasing.createSupplier({ name: body?.name ?? '', phone: body?.phone, note: body?.note });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name?: string; phone?: string | null; note?: string | null; active?: boolean },
  ) {
    return this.purchasing.updateSupplier(id, body);
  }

  @Post(':id/payments')
  pay(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { amount?: string; memo?: string; invoiceId?: string },
  ) {
    return this.purchasing.recordSupplierPayment(
      id,
      body?.amount ?? '',
      body?.memo,
      req.user!.id,
      body?.invoiceId,
    );
  }
}

@Roles('ADMIN')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get()
  list() {
    return this.purchasing.listInvoices();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasing.getInvoice(id);
  }

  @Post()
  create(
    @Req() req: Request,
    @Body()
    body: {
      supplierId?: string;
      invoiceNo?: string;
      invoiceDate?: string;
      payment?: PurchasePayment;
      allocation?: CostAllocation;
      extraCosts?: string;
      lines?: InvoiceLineInput[];
    },
  ) {
    if (!Array.isArray(body?.lines)) throw new BadRequestException('lines are required');
    return this.purchasing.createInvoice(
      {
        supplierId: body.supplierId ?? '',
        invoiceNo: body.invoiceNo,
        invoiceDate: body.invoiceDate ?? '',
        payment: body.payment ?? 'CREDIT',
        allocation: body.allocation,
        extraCosts: body.extraCosts,
        lines: body.lines,
      },
      req.user!.id,
    );
  }

  @Post(':id/post')
  post(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchasing.postInvoice(id, req.user!.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.purchasing.deleteDraft(id);
  }
}
