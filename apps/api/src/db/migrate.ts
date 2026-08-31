/** Applies pending migrations, then exits. Run with: npm run migrate */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

process.loadEnvFile('../../.env');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  await pool.end();
  console.log('migrations applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
