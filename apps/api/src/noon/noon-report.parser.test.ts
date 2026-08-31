import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NoonReportFormatError, parseNoonReport } from './noon-report.parser';

const HEADER = [
  'Contract', 'Contract Title', 'Reference Nr', 'Order Nr', 'Item Nr', 'Order Date',
  'Transaction Date', 'Title', 'SKUs', 'Partner SKUs', 'Transaction Type', 'Currency',
  'Net Proceeds', 'Referral Fee including VAT', 'Fullfilment & Logistics Fees including VAT',
  'Shipping Credits including VAT', 'Other Order Fees including VAT', 'Order Subsidies including VAT',
  'Non-Order Fees including VAT', 'Non-Order Subsidies including VAT', 'Others including VAT', 'Total',
].join(',');

/** A sold item, mirroring the shape of a real `order` line. */
const ITEM = 'MPC,Noon EG,PS-346654-EG20260731,NEGI700003,NEGI700003-1,2026-07-27,2026-07-31,"Compressor, 150 PSI",Z877AZ-1,PSKU_346654_9295_X,order,EGP,2899,-363.53,-24.51,0,0,0,0,0,0,2510.96';

/** A payout: no product, money only in `Others`. */
const PAYOUT = 'MPC,Noon EG,2026-07-29 Bank Transfer,,,,2026-07-29,Bank Transfer,,,payment,EGP,0,0,0,0,0,0,0,0,-59551.91,-59551.91';

const report = (...rows: string[]) => parseNoonReport([HEADER, ...rows].join('\n') + '\n');

test('reads an order line into normalised fields', () => {
  const [r] = report(ITEM);
  assert.equal(r.orderNr, 'NEGI700003');
  assert.equal(r.itemNr, 'NEGI700003-1');
  assert.equal(r.partnerSku, 'PSKU_346654_9295_X');
  assert.equal(r.transactionType, 'order');
  assert.equal(r.netProceeds, '2899');
  assert.equal(r.referralFee, '-363.53');
  assert.equal(r.total, '2510.96');
  // The title's comma must survive quoting.
  assert.equal(r.title, 'Compressor, 150 PSI');
});

test('non-product rows keep null identifiers rather than empty strings', () => {
  const [r] = report(PAYOUT);
  assert.equal(r.orderNr, null);
  assert.equal(r.itemNr, null);
  assert.equal(r.partnerSku, null);
  assert.equal(r.orderDate, null);
  assert.equal(r.others, '-59551.91');
});

test('blank money cells become zero, so sums never see NaN', () => {
  const [r] = report(PAYOUT);
  assert.equal(r.netProceeds, '0');
  assert.equal(r.referralFee, '0');
});

test('a row fingerprints stably, and differs from a neighbouring row', () => {
  const once = report(ITEM)[0].fingerprint;
  assert.equal(report(ITEM)[0].fingerprint, once, 'same input must fingerprint identically');
  assert.notEqual(report(PAYOUT)[0].fingerprint, once);
});

test('two lines differing only by item number are distinct rows — this is how quantity 2 is encoded', () => {
  const second = ITEM.replace('NEGI700003-1', 'NEGI700003-2');
  const rows = report(ITEM, second);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].fingerprint, rows[1].fingerprint);
});

test('a renamed or missing column fails loudly instead of importing zeroes', () => {
  const broken = HEADER.replace('Net Proceeds', 'Net Proceeds (EGP)');
  assert.throws(
    () => parseNoonReport(`${broken}\n${ITEM}\n`),
    (e: Error) => e instanceof NoonReportFormatError && /Net Proceeds/.test(e.message),
  );
});

test('a non-numeric amount is rejected', () => {
  assert.throws(
    () => report(ITEM.replace(',2899,', ',N/A,')),
    (e: Error) => e instanceof NoonReportFormatError,
  );
});

test('a malformed date is rejected', () => {
  assert.throws(
    () => report(ITEM.replace('2026-07-27', '27/07/2026')),
    (e: Error) => e instanceof NoonReportFormatError,
  );
});

test('trailing blank lines are ignored', () => {
  assert.equal(parseNoonReport(`${HEADER}\n${ITEM}\n\n`).length, 1);
});
