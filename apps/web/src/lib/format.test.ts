import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysAgo, money, moneyWhole, monthStart, today } from './format';

test('a negative amount keeps its minus in front, even inside Arabic text', () => {
  assert.equal(money(-1234.5), '‎-1,234.50');
  assert.equal(moneyWhole('-980'), '‎-980');
  assert.equal(money(1234.5), '1,234.50');
});

test('the day and the month turn over at midnight in Cairo, not on the server', () => {
  const afterMidnightInCairo = new Date('2026-09-30T22:30:00Z'); // 01:30 on 1 Oct, Cairo
  assert.equal(today(afterMidnightInCairo), '2026-10-01');
  assert.equal(monthStart(afterMidnightInCairo), '2026-10-01');
  assert.equal(daysAgo(1, afterMidnightInCairo), '2026-09-30');
  assert.equal(daysAgo(30, afterMidnightInCairo), '2026-09-01');
});
