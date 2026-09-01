import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import type { LedgerAccountCode } from './ledger-account.entity';
import type { LedgerEntryKind } from './ledger-entry.entity';
import { LedgerService } from './ledger.service';
import { FinanceService } from './finance.service';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Cash is admin-only, same as noon's financial data. */
@Roles('ADMIN')
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly ledger: LedgerService,
  ) {}

  @Get('overview')
  overview() {
    return this.finance.overview();
  }

  /** Every account with its current balance, in display order. */
  @Get('accounts')
  accounts() {
    return this.ledger.balances();
  }

  @Get('history')
  history(@Query('limit') limit?: string) {
    return this.finance.history(limit ? Number(limit) : undefined);
  }

  /** The full ledger, filtered — where every "trace" link lands. */
  @Get('ledger')
  ledger_(
    @Query('code') code?: string,
    @Query('kind') kind?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    for (const [name, value] of [['from', from], ['to', to]] as const) {
      if (value && !ISO_DATE.test(value)) throw new BadRequestException(`${name} must be YYYY-MM-DD`);
    }
    return this.ledger.entries({
      code: code as LedgerAccountCode | undefined,
      kind: kind as LedgerEntryKind | undefined,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Patch('anchor')
  setAnchor(@Body() body: { openingBalance?: string; openingAsOf?: string }) {
    const { openingBalance, openingAsOf } = body ?? {};
    if (!openingBalance || !openingAsOf || !ISO_DATE.test(openingAsOf)) {
      throw new BadRequestException('openingBalance and openingAsOf (YYYY-MM-DD) are required');
    }
    return this.finance.setAnchor(openingBalance, openingAsOf);
  }

  /** سند قبض / سند صرف / إيداع نقدي — a hand-entered cash movement. */
  @Post('vouchers')
  recordVoucher(
    @Req() req: Request,
    @Body()
    body: {
      direction?: 'IN' | 'OUT';
      counter?: LedgerAccountCode;
      amount?: string;
      memo?: string;
      occurredAt?: string;
    },
  ) {
    if (body?.direction !== 'IN' && body?.direction !== 'OUT') {
      throw new BadRequestException('direction must be IN or OUT');
    }
    if (!body.counter) throw new BadRequestException('counter account is required');
    return this.finance.recordVoucher({
      direction: body.direction,
      counter: body.counter,
      amount: body.amount ?? '',
      memo: body.memo,
      occurredAt: body.occurredAt,
      userId: req.user!.id,
    });
  }

  /** Kept for the current form; `vouchers` supersedes it. */
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
