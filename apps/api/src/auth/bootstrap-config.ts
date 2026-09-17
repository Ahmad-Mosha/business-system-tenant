const DEVELOPMENT_JWT_SECRET = 'dev-only-insecure-secret';
const DEVELOPMENT_ADMIN_PASSWORD = 'admin123';
const DEVELOPMENT_MODERATOR_PASSWORD = 'moderator123';

type AuthEnvironment = {
  NODE_ENV?: string;
  JWT_SECRET?: string;
  ADMIN_SEED_PASSWORD?: string;
  MODERATOR_SEED_PASSWORD?: string;
};

/**
 * Local development remains zero-config. A production process must have a
 * real signing key, because starting with a shared fallback would make every
 * session forgeable.
 */
export function resolveJwtSecret(environment: AuthEnvironment): string {
  const secret = environment.JWT_SECRET || DEVELOPMENT_JWT_SECRET;
  if (
    environment.NODE_ENV === 'production'
    && (secret === DEVELOPMENT_JWT_SECRET || secret.trim().length < 32)
  ) {
    throw new Error('Production requires JWT_SECRET with at least 32 characters.');
  }
  return secret;
}

/** Only called when the user table is empty and initial accounts are needed. */
export function resolveInitialPasswords(environment: AuthEnvironment): {
  admin: string;
  moderator: string;
} {
  const admin = environment.ADMIN_SEED_PASSWORD || DEVELOPMENT_ADMIN_PASSWORD;
  const moderator = environment.MODERATOR_SEED_PASSWORD || DEVELOPMENT_MODERATOR_PASSWORD;

  if (environment.NODE_ENV === 'production') {
    const invalid = [
      [admin, DEVELOPMENT_ADMIN_PASSWORD],
      [moderator, DEVELOPMENT_MODERATOR_PASSWORD],
    ].some(([password, knownDefault]) => password === knownDefault || password.trim().length < 12);
    if (invalid) {
      throw new Error(
        'An empty production user table requires ADMIN_SEED_PASSWORD and '
          + 'MODERATOR_SEED_PASSWORD, each with at least 12 characters.',
      );
    }
  }

  return { admin, moderator };
}
