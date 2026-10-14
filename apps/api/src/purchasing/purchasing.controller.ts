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
  Query,
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
  list(@Query('status') status?: string) {
    return this.purchasing.listSuppliers(status === 'archived');
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Query('cancelled') cancelled?: string) {
    return this.purchasing.supplierDetail(id, cancelled === '1');
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

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.purchasing.deleteSupplier(id);
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

  @Post(':id/payments/:entryId/reverse')
  reversePayment(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: { reason?: string },
  ) {
    return this.purchasing.reverseSupplierPayment(id, entryId, body?.reason ?? '', req.user!.id);
  }
}

@Roles('ADMIN')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get()
  list(@Query('cancelled') cancelled?: string) {
    return this.purchasing.listInvoices(cancelled === '1');
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
      requestId?: string;
      supplierId?: string;
      invoiceNo?: string;
      invoiceDate?: string;
      payment?: PurchasePayment;
      allocation?: CostAllocation;
      extraCosts?: string;
      extraCostsPaidSeparately?: boolean;
      postImmediately?: boolean;
      lines?: InvoiceLineInput[];
    },
  ) {
    if (!Array.isArray(body?.lines)) throw new BadRequestException('lines are required');
    return this.purchasing.createInvoice(
      {
        requestId: body.requestId,
        supplierId: body.supplierId ?? '',
        invoiceNo: body.invoiceNo,
        invoiceDate: body.invoiceDate ?? '',
        payment: body.payment ?? 'CREDIT',
        allocation: body.allocation,
        extraCosts: body.extraCosts,
        extraCostsPaidSeparately: body.extraCostsPaidSeparately,
        lines: body.lines,
      },
      req.user!.id,
      body.postImmediately === true,
    );
  }

  /** Rewrites a draft; refused once posted. */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      supplierId?: string;
      invoiceNo?: string;
      invoiceDate?: string;
      payment?: PurchasePayment;
      allocation?: CostAllocation;
      extraCosts?: string;
      extraCostsPaidSeparately?: boolean;
      lines?: InvoiceLineInput[];
    },
  ) {
    if (!Array.isArray(body?.lines)) throw new BadRequestException('lines are required');
    return this.purchasing.updateDraft(id, {
      supplierId: body.supplierId ?? '',
      invoiceNo: body.invoiceNo,
      invoiceDate: body.invoiceDate ?? '',
      payment: body.payment ?? 'CREDIT',
      allocation: body.allocation,
      extraCosts: body.extraCosts,
      extraCostsPaidSeparately: body.extraCostsPaidSeparately,
      lines: body.lines,
    });
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

  /** Cancel a posted invoice entered by mistake; `correct` re-enters it as a draft to fix. */
  @Post(':id/void')
  void(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string; correct?: boolean }) {
    return this.purchasing.voidInvoice(id, body?.reason ?? '', req.user!.id, body?.correct === true);
  }
}
