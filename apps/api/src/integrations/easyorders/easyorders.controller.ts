import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Public, Roles } from '../../auth/auth.guard';
import { EasyOrdersService } from './easyorders.service';

/** Constant-time compare that tolerates differing lengths. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Controller('integrations/easyorders')
export class EasyOrdersController {
  constructor(private readonly easyOrders: EasyOrdersService) {}

  /**
   * Webhook receiver. Public because Easy Orders calls it, authenticated by the
   * `secret` header it sends — the value configured when the webhook is created
   * in the seller dashboard.
   *
   * Answers 200 only after processing succeeds. A failed payload is already
   * stored, and a later redelivery retries it safely instead of duplicating it.
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Headers('secret') secret: string, @Body() body: unknown) {
    const expected = process.env.EASYORDERS_WEBHOOK_SECRET;
    if (!expected) {
      throw new ForbiddenException('EASYORDERS_WEBHOOK_SECRET is not configured');
    }
    if (!secret || !secretMatches(secret, expected)) {
      throw new ForbiddenException('invalid secret');
    }
    return this.easyOrders.ingest(body);
  }

  /** Deliveries that could not be turned into an order, for the admin UI. */
  @Roles('ADMIN')
  @Get('failures')
  failures() {
    return this.easyOrders.failures();
  }
}
