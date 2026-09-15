import assert from 'node:assert/strict';
import { test } from 'node:test';
import { money, moneyWhole } from './format';

test('a negative amount keeps its minus in front, even inside Arabic text', () => {
  assert.equal(money(-1234.5), '‎-1,234.50');
  assert.equal(moneyWhole('-980'), '‎-980');
  assert.equal(money(1234.5), '1,234.50');
});
