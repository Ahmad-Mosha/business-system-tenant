import assert from 'node:assert/strict';
import { test } from 'node:test';
import { naturalBalance } from './ledger.service';

test('asset and expense accounts read debit-positive', () => {
  // Cash: 1500 deposited (debit), 200 spent (credit) → 1300 on hand.
  assert.equal(naturalBalance('ASSET', 1500, 200), 1300);
  // COGS: 800 of cost incurred (debit), 50 reversed by a return (credit) → 750.
  assert.equal(naturalBalance('EXPENSE', 800, 50), 750);
});

test('liability, equity and income accounts read credit-positive', () => {
  // Supplier payable: 44,570 owed (credit), 20,000 paid (debit) → 24,570 still owed.
  assert.equal(naturalBalance('LIABILITY', 20000, 44570), 24570);
  // Owner capital: 1,500,000 in (credit), 100,000 withdrawn (debit) → 1,400,000.
  assert.equal(naturalBalance('EQUITY', 100000, 1500000), 1400000);
  // Sales: 411,080 earned (credit), 6,000 returned (debit) → 405,080.
  assert.equal(naturalBalance('INCOME', 6000, 411080), 405080);
});

test('a balanced entry nets to zero across its two accounts', () => {
  // One PURCHASE entry: debit INVENTORY 44570, credit SUPPLIER_PAYABLE 44570.
  const inventory = naturalBalance('ASSET', 44570, 0);
  const payable = naturalBalance('LIABILITY', 0, 44570);
  assert.equal(inventory - payable, 0);
});
