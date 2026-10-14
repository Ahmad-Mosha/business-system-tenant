import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';

/**
 * Catches a migration edited after it already ran on a database.
 *
 * A migration runs once per database, by name: an edit made afterwards never
 * reaches a database that ran the earlier text, and that database silently
 * drifts from the code (2026-10-14: a migration saved half-written ran under a
 * hot-reloading dev server, and its missing column surfaced as a 500 a day
 * later). Each migration's fingerprint is recorded when it is first seen as
 * run; a later mismatch is reported by name.
 *
 * The fingerprint is the migration's code with comments and spacing removed,
 * so rewording a comment never trips it. It is read from the TypeScript source
 * when present (development, the migrate command) and from the compiled file
 * otherwise (the production image ships only `dist`).
 */
export function fingerprintCode(code: string): string {
  const bare = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1').replace(/\s+/g, '');
  return createHash('sha256').update(bare).digest('hex');
}

const SOURCES = [join(process.cwd(), 'src/database/migrations'), join(__dirname, 'migrations')];

function fingerprintOf(name: string): string | null {
  const stamp = /(\d{10,})$/.exec(name)?.[1];
  if (!stamp) return null;
  for (const dir of SOURCES) {
    if (!existsSync(dir)) continue;
    const file = readdirSync(dir).find((f) => f.startsWith(`${stamp}-`) && /\.(ts|js)$/.test(f) && !f.endsWith('.d.ts'));
    if (file) return fingerprintCode(readFileSync(join(dir, file), 'utf8'));
  }
  return null;
}

export interface MigrationState {
  /** Ran on this database, but their file has changed since. */
  edited: string[];
  /** In the code, not yet run on this database. */
  pending: string[];
}

/**
 * Records fingerprints for migrations seen as run for the first time, and
 * reports any whose file changed since. `acceptEdits` re-records them instead —
 * for when someone has confirmed the database already matches the new text.
 */
export async function checkMigrations(db: DataSource, acceptEdits = false): Promise<MigrationState> {
  await db.query(`CREATE TABLE IF NOT EXISTS migration_fingerprint (
    name text PRIMARY KEY, fingerprint text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now())`);
  const ran: Array<{ name: string }> = await db.query('SELECT name FROM migrations');
  const stored = new Map<string, string>(
    (await db.query('SELECT name, fingerprint FROM migration_fingerprint')).map((r: { name: string; fingerprint: string }) => [r.name, r.fingerprint]),
  );
  const edited: string[] = [];
  for (const { name } of ran) {
    const now = fingerprintOf(name);
    if (!now) continue;
    const was = stored.get(name);
    if (was && was !== now && !acceptEdits) {
      edited.push(name);
    } else if (was !== now) {
      await db.query(
        `INSERT INTO migration_fingerprint (name, fingerprint) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET fingerprint = EXCLUDED.fingerprint, recorded_at = now()`,
        [name, now],
      );
    }
  }
  const done = new Set(ran.map((r) => r.name));
  const pending = db.migrations
    .map((m) => (m as { name?: string }).name ?? m.constructor.name)
    .filter((name) => !done.has(name));
  return { edited, pending };
}

/** What to do about edited migrations, said once for the API's boot and the migrate command alike. */
export const editedMessage = (edited: string[]) =>
  `Migration${edited.length > 1 ? 's' : ''} ${edited.join(', ')} changed after running on this database, ` +
  'so the database still has the old version and the change will never be applied. ' +
  'Undo the edit and put the change in a new migration. If you are sure the database already matches ' +
  'the new text, run once with MIGRATIONS_ACCEPT_EDITS=1 to record it.';
