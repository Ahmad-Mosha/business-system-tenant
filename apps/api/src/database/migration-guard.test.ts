import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fingerprintCode } from './migration-guard';

test('a migration fingerprint ignores comments and spacing, but not code', () => {
  const base = "await r.query('ALTER TABLE x ADD COLUMN y int');";
  assert.equal(fingerprintCode(base), fingerprintCode(`// adds y\n   ${base}   /* why */`));
  assert.notEqual(fingerprintCode(base), fingerprintCode(base.replace('int', 'bigint')));
  // A URL inside a string is code, not a comment.
  assert.notEqual(fingerprintCode("const u = 'http://a';"), fingerprintCode("const u = 'http://b';"));
});
