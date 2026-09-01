import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocateExtraCosts, allocateOldestFirst, movingAverage, round2 } from './costing';

test('a payment fills the oldest invoice remainders first', () => {
  // three invoices owing 2000, 5000, 1000; pay 6000
  assert.deepEqual(allocateOldestFirst([2000, 5000, 1000], 6000), [2000, 4000, 0]);
});

test('a payment that clears everything allocates it all', () => {
  const owed = [527.85, 2500, 6600];
  const applied = allocateOldestFirst(owed, 9627.85);
  assert.deepEqual(applied, [527.85, 2500, 6600]);
  assert.equal(round2(applied.reduce((a, b) => a + b, 0)), 9627.85);
});

test('an already-settled invoice in the list is skipped', () => {
  assert.deepEqual(allocateOldestFirst([0, 3000], 2500), [0, 2500]);
});

test('moving average blends the incoming cost by quantity', () => {
  // 100 @ 10.00, then receive 50 @ 12.00 → (1000 + 600) / 150 = 10.6667
  assert.equal(movingAverage(100, 10, 50, 12), 10.6667);
});

test('moving average uses the incoming cost when there is nothing on hand', () => {
  assert.equal(movingAverage(0, null, 40, 92), 92);
  assert.equal(movingAverage(-3, 50, 10, 44), 44);
});

test('extra costs allocate by value and sum back to the amount paid', () => {
  const lines = [
    { lineTotal: 11040, quantity: 120 },
    { lineTotal: 12450, quantity: 300 },
    { lineTotal: 14080, quantity: 80 },
  ];
  const shares = allocateExtraCosts(lines, 7000, 'BY_VALUE');
  assert.equal(round2(shares.reduce((a, b) => a + b, 0)), 7000);
  // The biggest-value line takes the biggest share.
  assert.ok(shares[2] > shares[0]);
});

test('extra costs allocate per unit and sum back exactly', () => {
  const lines = [
    { lineTotal: 100, quantity: 1 },
    { lineTotal: 100, quantity: 2 },
  ];
  const shares = allocateExtraCosts(lines, 30, 'PER_UNIT');
  assert.deepEqual(shares, [10, 20]);
  assert.equal(shares[0] + shares[1], 30);
});

test('a lopsided split still reconciles to the last cent', () => {
  const lines = [
    { lineTotal: 1, quantity: 1 },
    { lineTotal: 1, quantity: 1 },
    { lineTotal: 1, quantity: 1 },
  ];
  const shares = allocateExtraCosts(lines, 10, 'BY_VALUE');
  assert.equal(round2(shares.reduce((a, b) => a + b, 0)), 10);
});
