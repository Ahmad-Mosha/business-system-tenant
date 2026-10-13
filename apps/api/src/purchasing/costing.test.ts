import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocateExtraCosts, allocateOldestFirst, lineTotalFor, movingAverage, round2, unitCostFor } from './costing';

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


test('many tiny landed shares never make the last line negative', () => {
  const lines = Array.from({ length: 100 }, () => ({ lineTotal: 1, quantity: 1 }));
  for (const method of ['BY_VALUE', 'PER_UNIT'] as const) {
    const shares = allocateExtraCosts(lines, 0.51, method);
    assert.ok(shares.every((share) => share >= 0));
    assert.equal(Math.round(shares.reduce((sum, share) => sum + share, 0) * 100), 51);
    assert.equal(shares.filter((share) => share === 0.01).length, 51);
  }
});

test('a typed unit cost gives the line total to the cent, half up', () => {
  assert.equal(lineTotalFor('33.3333', 3), '100.00');
  assert.equal(lineTotalFor('135.5', 12), '1626.00');
  assert.equal(lineTotalFor('0.0050', 1), '0.01');
  assert.equal(lineTotalFor('0.0049', 1), '0.00');
  assert.equal(lineTotalFor('1.005', 1), '1.01');
  assert.equal(lineTotalFor('19.99', 1000), '19990.00');
  assert.equal(lineTotalFor('12', 7), '84.00');
});

test('a typed line total keeps its amount and derives the unit cost', () => {
  assert.equal(unitCostFor('100', 3), '33.3333');
  assert.equal(unitCostFor('100.00', 6), '16.6667');
  assert.equal(unitCostFor('10600', 4), '2650.0000');
  assert.equal(unitCostFor('0.01', 3), '0.0033');
  assert.equal(unitCostFor('1', 1), '1.0000');
});
