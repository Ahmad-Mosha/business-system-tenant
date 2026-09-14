import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removalError } from './catalog.service';

test('stock added by hand is always allowed', () => {
  assert.equal(removalError(0, 5), null);
  assert.equal(removalError(-1131, 1131), null);
});

test('stock removed by hand stops at zero', () => {
  assert.equal(removalError(16, -16), null);
  assert.match(removalError(16, -17) ?? '', /up to 16/);
  assert.match(removalError(0, -1) ?? '', /nothing on hand/);
  assert.match(removalError(-3, -1) ?? '', /nothing on hand/);
});
