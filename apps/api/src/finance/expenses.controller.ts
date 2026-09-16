import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { ExpensesService, type ExpenseInput } from './expenses.service';

@Roles('ADMIN')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}
  @Get('categories') categories() { return this.expenses.categories(); }
  @Get() list(@Query() query: { category?: string; search?: string; from?: string; to?: string; page?: string }) {
    return this.expenses.list({ ...query, page: Number(query.page) || 1 });
  }
  @Post() create(@Req() req: Request, @Body() body: ExpenseInput) { return this.expenses.create(body, req.user!.id); }
  @Post(':id/void') void(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { reason: string }) {
    return this.expenses.void(id, body.reason, req.user!.id);
  }
}
