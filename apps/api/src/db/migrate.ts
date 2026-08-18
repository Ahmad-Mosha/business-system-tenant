import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import postgres from 'postgres';
import { loadDotEnv } from '../config/load-dotenv.js';
import { createDatabase } from './db.module.js';

loadDotEnv();

/**
 * Applies pending migrations. Run before starting the API, in CI, and in deployment.
 * Uses a single dedicated connection - drizzle's migrator takes an advisory lock.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const here = __dirname;
  const client = postgres(url, { max: 1 });
  try {
    await migrate(createDatabase(client), { migrationsFolder: path.join(here, 'migrations') });
    console.log('Migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
