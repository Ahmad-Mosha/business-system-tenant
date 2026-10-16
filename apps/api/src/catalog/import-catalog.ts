import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import dataSource from '../database/data-source';
import { importLinkedCatalog, validateLinkedCatalog, type LinkedProduct } from './linked-catalog-import';

/**
 * `npm run catalog:import -- <linked-catalog.json> [--apply] [--actor=email]`
 *
 * Loads a linked catalogue (products with their noon, Amazon and website
 * listings and opening stock). Without `--apply` it only reports what it
 * would do. Says which database it is about to change before changing it.
 */
async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');
  const actorEmail = args.find((a) => a.startsWith('--actor='))?.slice('--actor='.length);
  if (!file) throw new Error('usage: catalog:import <linked-catalog.json> [--apply] [--actor=email]');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (root .env, or set it on the command line).');
  const target = new URL(url);
  console.log(`Database: ${target.hostname}:${target.port || 5432}${target.pathname}${apply ? '' : '  (dry run — nothing is written)'}`);

  const { products } = JSON.parse(readFileSync(file, 'utf8')) as { products: LinkedProduct[] };
  const problems = validateLinkedCatalog(products);
  if (problems.length) {
    console.error(`The file has ${problems.length} problem(s); nothing was imported:\n${problems.slice(0, 30).join('\n')}`);
    process.exitCode = 1;
    return;
  }

  await dataSource.initialize();
  try {
    let actorId: string | null = null;
    if (actorEmail) {
      const [user] = await dataSource.query('SELECT id FROM app_user WHERE email = $1', [actorEmail]);
      if (!user) throw new Error(`no user ${actorEmail}`);
      actorId = user.id;
    }
    const report = await importLinkedCatalog(dataSource, products, { actorId, apply });
    console.log(`${apply ? 'Created' : 'Would create'} ${report.created} products with ${report.listings} listings; ` +
      `opening stock ${report.units.warehouse} in the warehouse and ${report.units.noon} at noon.`);
    if (report.skipped.length) console.log(`Skipped ${report.skipped.length} already in the catalogue, e.g. ${report.skipped.slice(0, 3).map((s) => `${s.name} → ${s.linkedTo}`).join('; ')}`);
    if (report.failed.length) {
      console.error(`Failed ${report.failed.length}:\n${report.failed.map((f) => `${f.name}: ${f.reason}`).join('\n')}`);
      process.exitCode = 1;
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
