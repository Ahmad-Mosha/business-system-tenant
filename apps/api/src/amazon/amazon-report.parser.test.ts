import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AmazonReportFormatError, amazonDate, parseAmazonReport } from './amazon-report.parser';

const NOTES = [
  '"Includes Amazon Marketplace, Fulfillment by Amazon (FBA), and Amazon Webstore transactions"',
  '"All amounts in local currency, unless specified"',
  '"date/time: posted date/time of the transaction"',
];
const HEADER = '"date/time","settlement id","type","order id","sku","description","quantity","marketplace","fulfillment","order city","order state","order postal","product sales","shipping credits","promotional rebates","selling fees","fba fees","other transaction fees","other","total","Transaction Status","Transaction Release Date"';
const ORDER = '"1 Aug 2026 1:23:07 PM UTC","111","Order","171-0000000-0000001","SKU-A","Steam cleaner, 1500W","2","amazon.eg","Seller","City","State","","2,980.00","26.00","0","-40.63","-12.00","0","12.00","2,965.37","Deferred","9 Aug 2026 11:30:29 PM UTC"';
const FEE = '"1 Aug 2026 1:23:01 PM UTC","111","Amazon Fees","171-0000000-0000001","","Amazon Easy Ship Charges","","Amazon.eg","","","","","0","0","0","-53.01","0","0","0","-53.01","Released","1 Aug 2026 1:23:01 PM UTC"';
const TRANSFER = '"3 Aug 2026 12:00:00 AM UTC","111","Transfer","","","To account ending with: 100","","","","","","","0","0","0","0","0","0","-7,500.46","-7,500.46","Released","3 Aug 2026 12:00:00 AM UTC"';

const report = (...rows: string[]) => parseAmazonReport([...NOTES, HEADER, ...rows].join('\n') + '\n');

test('skips the notes, reads an order line with its quantity and thousands separators', () => {
  const [r] = report(ORDER);
  assert.equal(r.type, 'Order');
  assert.equal(r.sku, 'SKU-A');
  assert.equal(r.quantity, 2);
  assert.equal(r.description, 'Steam cleaner, 1500W');
  assert.equal(r.productSales, '2980.00');
  assert.equal(r.total, '2965.37');
  assert.equal(r.status, 'Deferred');
  assert.equal(r.releaseAt?.toISOString(), '2026-08-09T23:30:29.000Z');
});

test('lines with no product keep null identifiers, and money in the other column', () => {
  const [fee, transfer] = report(FEE, TRANSFER);
  assert.equal(fee.sku, null);
  assert.equal(fee.quantity, 0);
  assert.equal(fee.orderId, '171-0000000-0000001');
  assert.equal(transfer.orderId, null);
  assert.equal(transfer.other, '-7500.46');
});

test('times are UTC with a 12-hour clock', () => {
  assert.equal(amazonDate('30 Jun 2026 9:41:24 PM UTC').toISOString(), '2026-06-30T21:41:24.000Z');
  assert.equal(amazonDate('3 Aug 2026 12:05:00 AM UTC').toISOString(), '2026-08-03T00:05:00.000Z');
  assert.equal(amazonDate('3 Aug 2026 12:05:00 PM UTC').toISOString(), '2026-08-03T12:05:00.000Z');
  assert.throws(() => amazonDate('Aug 3, 2026 12:05:00 PM PDT'), AmazonReportFormatError);
});

test('a line released later keeps its fingerprint; two identical lines get two', () => {
  const [deferred] = report(ORDER);
  const [released] = report(ORDER.replace('"Deferred"', '"Released"').replace('"111"', '"222"'));
  assert.equal(deferred.fingerprint, released.fingerprint);
  assert.equal(released.status, 'Released');
  const [a, b] = report(FEE, FEE);
  assert.notEqual(a.fingerprint, b.fingerprint);
  assert.deepEqual(report(FEE, FEE).map((r) => r.fingerprint), [a.fingerprint, b.fingerprint]);
});

test('anything else is refused loudly', () => {
  assert.throws(() => parseAmazonReport('a,b,c\n1,2,3\n'), /not an Amazon transaction report/);
  assert.throws(() => report(ORDER.replace('"2,980.00"', '"n/a"')), /not a number/);
});
