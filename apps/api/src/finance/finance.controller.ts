import { BadRequestException, Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { FinanceService } from './finance.service';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Cash is admin-only, same as noon's financial data. */
@Roles('ADMIN')
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('overview')
  overview() {
    return this.finance.overview();
  }

  @Get('history')
  history(@Query('limit') limit?: string) {
    return this.finance.history(limit ? Number(limit) : undefined);
  }

  @Patch('anchor')
  setAnchor(@Body() body: { openingBalance?: string; openingAsOf?: string }) {
    const { openingBalance, openingAsOf } = body ?? {};
    if (!openingBalance || !openingAsOf || !ISO_DATE.test(openingAsOf)) {
      throw new BadRequestException('openingBalance and openingAsOf (YYYY-MM-DD) are required');
    }
    return this.finance.setAnchor(openingBalance, openingAsOf);
  }

  @Post('capital')
  recordCapital(
    @Req() req: Request,
    @Body() body: { amount?: string; direction?: 'IN' | 'OUT'; note?: string },
  ) {
    const direction = body?.direction;
    if (direction !== 'IN' && direction !== 'OUT') {
      throw new BadRequestException('direction must be IN or OUT');
    }
    return this.finance.recordCapital(body.amount ?? '', direction, body.note, req.user!.id);
  }
}
