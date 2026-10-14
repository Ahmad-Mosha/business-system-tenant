import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysAgo, money, moneyWhole, monthStart, today } from './format';

test('a negative amount keeps its minus in front, even inside Arabic text', () => {
  assert.equal(money(-1234.5), '‎-1,234.50');
  assert.equal(moneyWhole('-980'), '‎-980');
  assert.equal(money(1234.5), '1,234.50');
});

test('whole pounds carry no .00 — piastres show only when there are some', async () => {
  const { moneyParts } = await import('./format');
  assert.equal(money('20000.00'), '20,000');
  assert.equal(money('20000.5'), '20,000.50');
  assert.equal(money('0.04'), '0.04');
  assert.deepEqual(moneyParts('871519.28'), { sign: '', whole: '871,519', frac: '.28' });
  assert.deepEqual(moneyParts('-1500'), { sign: '−', whole: '1,500', frac: '' });
});

test('the day and the month turn over at midnight in Cairo, not on the server', () => {
  const afterMidnightInCairo = new Date('2026-09-30T22:30:00Z'); // 01:30 on 1 Oct, Cairo
  assert.equal(today(afterMidnightInCairo), '2026-10-01');
  assert.equal(monthStart(afterMidnightInCairo), '2026-10-01');
  assert.equal(daysAgo(1, afterMidnightInCairo), '2026-09-30');
  assert.equal(daysAgo(30, afterMidnightInCairo), '2026-09-01');
});

test('a unit cost shows up to four decimals and never pads beyond two', async () => {
  const { unitMoney } = await import('./format');
  assert.equal(unitMoney('33.3333'), '33.3333');
  assert.equal(unitMoney('120.0000'), '120');
  assert.equal(unitMoney('2650.5'), '2,650.50');
});
