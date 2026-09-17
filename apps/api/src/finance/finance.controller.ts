import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import type { ChequeStatus } from './cheque.entity';
import type { LedgerAccountCode } from './ledger-account.entity';
import type { LedgerEntryKind } from './ledger-entry.entity';
import { LedgerService } from './ledger.service';
import { FinanceService } from './finance.service';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

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

  /** One account's recent movements with a running balance — drives the Treasury screen. */
  @Get('accounts/:code/ledger')
  accountLedger(@Param('code') code: string, @Query('limit') limit?: string) {
    if (!/^[A-Z_]+$/.test(code)) throw new BadRequestException('unknown account');
    return this.ledger.accountLedger(code as LedgerAccountCode, limit ? Number(limit) : undefined);
  }

  /** Daily cash balance for the overview chart. `days` back from today, max 365. */
  @Get('cash-series')
  cashSeries(@Query('days') days?: string) {
    const n = Math.min(Math.max(Number(days) || 90, 7), 365);
    const from = new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    return this.ledger.dailyBalance('CASH', from);
  }

  /**
   * Money into and out of the treasury between two dates — per `bucket` (day,
   * week or month) and by where it came from and went. Drives the overview's
   * cash-flow charts and Treasury's month totals.
   */
  @Get('cash-flow')
  cashFlow(@Query('from') from?: string, @Query('to') to?: string, @Query('bucket') bucket?: string) {
    if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
      throw new BadRequestException('from and to are required as YYYY-MM-DD, with from on or before to');
    }
    const b = bucket === 'week' || bucket === 'month' ? bucket : 'day';
    return this.ledger.flow('CASH', from, to, b);
  }

  /** Revenue and cost components for a period — the overview's "this month" panel. */
  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    const today = new Date().toISOString().slice(0, 10);
    const first = today.slice(0, 8) + '01';
    const f = from && ISO_DATE.test(from) ? from : first;
    const t = to && ISO_DATE.test(to) ? to : today;
    return this.ledger.periodSummary(f, t);
  }

  /** Confirmed owner measure for manual/social and Easy Orders: sale minus order shipping. */
  @Get('business-profit')
  businessProfit(@Query('from') from?: string, @Query('to') to?: string, @Query('bucket') bucket?: string) {
    if (!isDate(from) || !isDate(to) || from > to) {
      throw new BadRequestException('from and to are required as real YYYY-MM-DD dates, with from on or before to');
    }
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    if (days > 366) throw new BadRequestException('business profit ranges cannot exceed 367 days');
    const b = bucket === 'week' || bucket === 'month' ? bucket : 'day';
    return this.ledger.businessProfit(from, to, b);
  }

  /** The full ledger, filtered — where every "trace" link lands. */
  @Get('ledger')
  ledger_(
    @Query('sourceType') sourceType?: string,
    @Query('sourceId') sourceId?: string,
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
      sourceType, sourceId,
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

  @Get('cheques')
  cheques(@Query('status') status?: ChequeStatus) {
    return this.finance.listCheques(
      status === 'PENDING' || status === 'CLEARED' || status === 'BOUNCED' ? status : undefined,
    );
  }

  /** إيداع سندي — a received cheque, held pending until it clears. */
  @Post('cheques')
  createCheque(
    @Req() req: Request,
    @Body()
    body: { amount?: string; fromParty?: string; receivedDate?: string; dueDate?: string; memo?: string },
  ) {
    return this.finance.createCheque(
      {
        amount: body?.amount ?? '',
        fromParty: body?.fromParty ?? '',
        receivedDate: body?.receivedDate ?? '',
        dueDate: body?.dueDate,
        memo: body?.memo,
      },
      req.user!.id,
    );
  }

  @Patch('cheques/:id')
  settleCheque(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status?: 'CLEARED' | 'BOUNCED'; clearedDate?: string },
  ) {
    if (body?.status !== 'CLEARED' && body?.status !== 'BOUNCED') {
      throw new BadRequestException('status must be CLEARED or BOUNCED');
    }
    return this.finance.settleCheque(id, body.status, body.clearedDate, req.user!.id);
  }
}
