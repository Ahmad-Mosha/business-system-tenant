import { QueryFailedError } from 'typeorm';

/** True when `error` is Postgres refusing a duplicate on the named unique constraint. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const driver = error instanceof QueryFailedError ? (error.driverError as { code?: string; constraint?: string }) : null;
  return driver?.code === '23505' && driver.constraint === constraint;
}
