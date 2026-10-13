import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lineTotalFor, priceLine, trimZeros, unitCostFor } from './purchase-line';

test('matches the API: unit cost to total and back, exactly', () => {
  assert.equal(lineTotalFor('33.3333', 3), '100.00');
  assert.equal(lineTotalFor('1.005', 1), '1.01');
  assert.equal(unitCostFor('100', 3), '33.3333');
  assert.equal(unitCostFor('10600', 4), '2650.0000');
});

test('the typed figure stays fixed when the quantity changes', () => {
  assert.deepEqual(priceLine({ quantity: '3', unitCost: '', lineTotal: '100', source: 'total' }), { unitCost: '33.3333', lineTotal: '100' });
  assert.deepEqual(priceLine({ quantity: '4', unitCost: '', lineTotal: '100', source: 'total' }), { unitCost: '25', lineTotal: '100' });
  assert.deepEqual(priceLine({ quantity: '4', unitCost: '25', source: 'unit' }), { unitCost: '25', lineTotal: '100.00' });
  assert.deepEqual(priceLine({ quantity: '5', unitCost: '25' }), { unitCost: '25', lineTotal: '125.00' });
});

test('nothing is derived from an empty or invalid quantity', () => {
  assert.deepEqual(priceLine({ quantity: '', unitCost: '', lineTotal: '100', source: 'total' }), { unitCost: '', lineTotal: '100' });
  assert.deepEqual(priceLine({ quantity: '0', unitCost: '25', source: 'unit' }), { unitCost: '25', lineTotal: '' });
});

test('derived figures drop padding zeros only', () => {
  assert.equal(trimZeros('33.3300'), '33.33');
  assert.equal(trimZeros('25.0000'), '25');
  assert.equal(trimZeros('1200'), '1200');
});
