import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ormOptions } from './orm-options';

/**
 * CLI-only entry point for `migration:generate` / `migration:run` / `migration:revert`.
 * Needs DATABASE_URL set in the invoking shell — this never goes through Nest's
 * ConfigModule, so a repo-root `.env` is not read automatically here.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ...ormOptions,
  synchronize: false,
});
