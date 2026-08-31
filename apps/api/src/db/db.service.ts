import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';

export type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;
  /**
   * Unscoped handle. Only safe for tables with no tenant column — the tenant
   * registry itself. Everything else goes through `asTenant`.
   */
  readonly db: NodePgDatabase<typeof schema>;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: 10,
    });

    // The connection string authenticates as the database owner, who bypasses
    // row-level security. Dropping to prime_app on every connection is what
    // makes the policies apply at all.
    this.pool.on('connect', (client) => {
      void client.query('SET ROLE prime_app');
    });

    this.db = drizzle(this.pool, { schema, casing: 'snake_case' });
  }

  /**
   * Runs `fn` in a transaction with the tenant set, so every policy resolves.
   * `set_config(..., true)` is transaction-local, so the value cannot leak to
   * the next request that borrows this pooled connection.
   */
  async asTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      return fn(tx);
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
