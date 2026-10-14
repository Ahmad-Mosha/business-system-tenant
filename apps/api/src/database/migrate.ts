import 'reflect-metadata';
import dataSource from './data-source';
import { checkMigrations, editedMessage } from './migration-guard';

/**
 * `npm run db:migrate` — applies waiting migrations on purpose, when they are
 * finished. In development the API no longer runs them on every hot reload
 * (`MIGRATIONS=manual` in `npm run dev`), so a migration file is never applied
 * half-written. Production still migrates on boot: a deploy is deliberate.
 *
 * Says which database it is about to change before changing it.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (root .env, or set it on the command line).');
  const target = new URL(url);
  console.log(`Database: ${target.hostname}:${target.port || 5432}${target.pathname}`);

  await dataSource.initialize();
  try {
    const before = await checkMigrations(dataSource, process.env.MIGRATIONS_ACCEPT_EDITS === '1');
    if (before.edited.length) {
      console.error(editedMessage(before.edited));
      process.exitCode = 1;
      return;
    }
    const ran = await dataSource.runMigrations({ transaction: 'all' });
    await checkMigrations(dataSource); // records the new ones' fingerprints
    console.log(ran.length ? `Applied: ${ran.map((m) => m.name).join(', ')}` : 'Nothing to apply — the database is up to date.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
