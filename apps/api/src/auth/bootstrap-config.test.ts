import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveInitialPasswords, resolveJwtSecret } from './bootstrap-config';

test('local auth configuration keeps the documented development defaults', () => {
  assert.equal(resolveJwtSecret({}), 'dev-only-insecure-secret');
  assert.deepEqual(resolveInitialPasswords({}), {
    admin: 'admin123',
    moderator: 'moderator123',
  });
});

test('production refuses a missing or short session secret', () => {
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET/);
  assert.throws(
    () => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }),
    /JWT_SECRET/,
  );
  assert.throws(
    () => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: ' '.repeat(32) }),
    /JWT_SECRET/,
  );
});

test('production accepts an explicit session secret of at least 32 characters', () => {
  const secret = 'a'.repeat(32);
  assert.equal(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret }), secret);
});

test('production refuses missing, known, or short bootstrap passwords', () => {
  const base = {
    NODE_ENV: 'production',
    ADMIN_SEED_PASSWORD: 'long-enough-admin-password',
    MODERATOR_SEED_PASSWORD: 'long-enough-moderator-password',
  };
  assert.throws(() => resolveInitialPasswords({ ...base, ADMIN_SEED_PASSWORD: undefined }), /empty production/);
  assert.throws(() => resolveInitialPasswords({ ...base, ADMIN_SEED_PASSWORD: 'admin123' }), /empty production/);
  assert.throws(() => resolveInitialPasswords({ ...base, MODERATOR_SEED_PASSWORD: 'short' }), /empty production/);
  assert.throws(() => resolveInitialPasswords({ ...base, MODERATOR_SEED_PASSWORD: ' '.repeat(12) }), /empty production/);
});

test('production accepts explicit bootstrap passwords', () => {
  assert.deepEqual(resolveInitialPasswords({
    NODE_ENV: 'production',
    ADMIN_SEED_PASSWORD: 'long-enough-admin-password',
    MODERATOR_SEED_PASSWORD: 'long-enough-moderator-password',
  }), {
    admin: 'long-enough-admin-password',
    moderator: 'long-enough-moderator-password',
  });
});
