import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './password';

test('accepts the correct password', async () => {
  const stored = await hashPassword('admin123');
  assert.equal(await verifyPassword('admin123', stored), true);
});

test('rejects the wrong password', async () => {
  const stored = await hashPassword('admin123');
  assert.equal(await verifyPassword('admin124', stored), false);
  assert.equal(await verifyPassword('', stored), false);
});

test('salts, so the same password hashes differently every time', async () => {
  assert.notEqual(await hashPassword('same'), await hashPassword('same'));
});

test('malformed stored values are rejected, not thrown on', async () => {
  for (const bad of ['', 'nope', 'a:b', ':', 'deadbeef:']) {
    assert.equal(await verifyPassword('x', bad), false, `should reject ${JSON.stringify(bad)}`);
  }
});
