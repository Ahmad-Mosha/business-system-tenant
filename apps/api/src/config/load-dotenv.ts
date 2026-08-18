import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Loads the repository-root .env for local development and tests.
 *
 * In production the platform supplies real environment variables and there is no .env
 * file, so this is a no-op - it never overrides values that are already set.
 */
export function loadDotEnv(): void {
  if (process.env.NODE_ENV === 'production') return;

  const here = __dirname;
  // src/config -> src -> apps/api -> apps -> repo root
  const candidates = [
    path.resolve(here, '../../../../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (found) config({ path: found, override: false, quiet: true });
}
