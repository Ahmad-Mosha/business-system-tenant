import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import postgres from 'postgres';
import { loadDotEnv } from '../src/config/load-dotenv.js';
import { createDatabase } from '../src/db/db.module.js';

/**
 * Runs once for the whole suite: brings the dedicated test database up to the current
 * schema. Tests truncate between cases rather than re-migrating.
 */
export default async function setup() {
  loadDotEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is required to run tests (see .env.example)');
  }
  // Migrator NOTICEs ('relation already exists, skipping') are expected noise here.
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(createDatabase(client), {
      migrationsFolder: path.join(__dirname, '../src/db/migrations'),
    });
  } finally {
    await client.end();
  }
}
