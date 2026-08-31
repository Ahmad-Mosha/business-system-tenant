import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { Public } from './auth/auth.guard.js';
import { DbService } from './db/db.service.js';

@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Is the API up and can it reach the database',
    description: 'No token needed. Used by the deployment to know the service is alive.',
  })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', database: 'ok', uptimeSeconds: 128 },
    },
  })
  async check() {
    let database = 'ok';
    try {
      await this.db.db.execute(sql`select 1`);
    } catch {
      database = 'unreachable';
    }
    return { status: 'ok', database, uptimeSeconds: Math.round(process.uptime()) };
  }
}
