import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectOn, entryMemo } from './money';

const cash = { code: 'CASH', kind: 'ASSET' } as const;
const payable = { code: 'SUPPLIER_PAYABLE', kind: 'LIABILITY' } as const;
const sale = { amount: '490.00', debitCode: 'CASH', creditCode: 'SALES' };
const creditPurchase = { amount: '400.00', debitCode: 'INVENTORY', creditCode: 'SUPPLIER_PAYABLE' };
const supplierPayment = { amount: '2900.00', debitCode: 'SUPPLIER_PAYABLE', creditCode: 'CASH' };

test('an entry is signed by what it did to the account it is read from', () => {
  assert.equal(effectOn(sale, cash), 490);
  assert.equal(effectOn(supplierPayment, cash), -2900);
  assert.equal(effectOn(creditPurchase, cash), null);
  // A liability grows on its credit side: buying on credit means owing more.
  assert.equal(effectOn(creditPurchase, payable), 400);
  assert.equal(effectOn(supplierPayment, payable), -2900);
});

test('a memo drops what its row already says', () => {
  assert.equal(entryMemo({ memo: 'Reversal — ORDER_SALE', kind: 'ORDER_SALE', reversesId: 'x' }), null);
  assert.equal(entryMemo({ memo: 'Reversal — Purchase invoice INV-1', kind: 'PURCHASE', reversesId: 'x' }), 'INV-1');
  assert.equal(entryMemo({ memo: 'Purchase invoice', kind: 'PURCHASE', reversesId: null }), null);
  assert.equal(entryMemo({ memo: 'Opening cash balance', kind: 'OPENING_BALANCE', reversesId: null }), null);
  assert.equal(entryMemo({ memo: 'Payment to مورد تست', kind: 'SUPPLIER_PAYMENT', reversesId: null }), 'مورد تست');
  assert.equal(entryMemo({ memo: 'Cheque from الشريك أحمد cleared', kind: 'CHEQUE_CLEAR', reversesId: null }), 'الشريك أحمد');
  // What a person typed stays exactly as typed.
  assert.equal(entryMemo({ memo: 'رسوم بوسطة لشهر أغسطس', kind: 'PAYMENT_OUT', reversesId: null }), 'رسوم بوسطة لشهر أغسطس');
});
