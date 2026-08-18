import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from './db/db.module.js';
import { Public } from './modules/identity/auth.guard.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Reports database reachability, so a deploy can fail fast instead of serving errors. */
  @Public()
  @Get()
  async check(): Promise<{ status: string; database: string }> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', database: 'ok' };
    } catch {
      return { status: 'degraded', database: 'unreachable' };
    }
  }
}
