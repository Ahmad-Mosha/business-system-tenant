import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ENV, loadEnv, type Env } from '../config/env.js';
import * as schema from './schema.js';

export const DB = Symbol('DB');
export const SQL_CLIENT = Symbol('SQL_CLIENT');

export function createDatabase(client: postgres.Sql) {
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabase>;

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: (): Env => loadEnv() },
    {
      provide: SQL_CLIENT,
      inject: [ENV],
      useFactory: (env: Env) => postgres(env.DATABASE_URL, { max: 10 }),
    },
    { provide: DB, inject: [SQL_CLIENT], useFactory: (c: postgres.Sql) => createDatabase(c) },
  ],
  exports: [DB, ENV],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(SQL_CLIENT) private readonly client: postgres.Sql) {}

  /** Drains the connection pool so the process can exit cleanly. */
  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

export { schema };
