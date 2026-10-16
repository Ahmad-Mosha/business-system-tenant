import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ExpensesService } from '../finance/expenses.service';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DataSource } from 'typeorm';
import { ormOptions } from './orm-options';
import { checkMigrations } from './migration-guard';
import { NoonImportService } from '../noon/noon-import.service';
import { importLinkedCatalog, validateLinkedCatalog, type LinkedProduct } from '../catalog/linked-catalog-import';
import { LedgerService } from '../finance/ledger.service';
import { FinanceService } from '../finance/finance.service';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/order.entity';
import { PurchasingService } from '../purchasing/purchasing.service';
import { CatalogService } from '../catalog/catalog.service';
import { CatalogController } from '../catalog/catalog.controller';
import { SalesService } from '../sales/sales.service';
import { AmazonImportService } from '../amazon/amazon-import.service';
import { AmazonReportingService } from '../reporting/amazon-reporting.service';
import { PerformanceService } from '../reporting/performance.service';
import type { Request } from 'express';
import { Product } from '../catalog/product.entity';
import { ProductVariant } from '../catalog/product-variant.entity';
import { StockMovement } from '../inventory/stock-movement.entity';
import { User } from '../auth/user.entity';
import { EasyOrdersService } from '../integrations/easyorders/easyorders.service';
import { BostaService } from '../integrations/bosta/bosta.service';
import type { BostaDeliveryRaw } from '../integrations/bosta/bosta.client';

// Explicit, disposable local database only. Never uses the application's DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;
test('concurrent operations preserve stock, cash and supplier balances', { skip: !url }, async (t) => {
  const target = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
  assert.ok(target.pathname.endsWith('_test'), 'requires a disposable database ending in _test');
  const db = await new DataSource({ ...ormOptions, type: 'postgres', url, migrationsRun: true }).initialize();
  t.after(() => db.destroy());
  const ledger = new LedgerService(db);
  await ledger.seedAccounts();
  const finance = new FinanceService(db, ledger);
  const orders = new OrdersService(db, finance);
  const easyOrders = new EasyOrdersService(db, finance);
  const purchasing = new PurchasingService(db, ledger);
  const user = await db.getRepository(User).save({ email: `test-${Date.now()}@example.invalid`, name: 'Test', passwordHash: 'unused', role: 'ADMIN' });
  const actor = { id: user.id, name: user.name, role: 'ADMIN' as const, email: user.email };
  async function emptyProduct() {
    const product = await db.getRepository(Product).save({ name: `Integrity test ${randomUUID()}` });
    const variant = await db.getRepository(ProductVariant).save({ productId: product.id, unitCost: '10.00' });
    return { product, variant };
  }
  async function stock(quantity: number) {
    const { variant } = await emptyProduct();
    await db.getRepository(StockMovement).save({ variantId: variant.id, quantity, reason: 'COUNT' });
    return variant.id;
  }
  const input = (variantId: string, quantity = 1) => ({ customerName: 'Test', customerPhone: '01012345678', governorate: 'القاهرة', items: [{ variantId, quantity, unitPrice: '20.00' }] });
  const balance = async (id: string) => Number((await db.query('SELECT SUM(quantity) AS n FROM stock_movement WHERE variant_id = $1', [id]))[0].n);

  /** A refusal with this code — the headline or one of its reasons — as the screen reads it. */
  const refusedWith = (code: string, check?: (body: Refusal) => void) => (error: unknown) => {
    const body = (error as { getResponse?: () => Refusal }).getResponse?.() ?? ({} as Refusal);
    const codes = [body.code, ...(body.reasons ?? []).map((r) => r.code)];
    assert.ok(codes.includes(code), `expected ${code}, got ${JSON.stringify(body)}`);
    check?.(body);
    return true;
  };
  type Refusal = { code?: string; params?: Record<string, unknown>; blockers?: Array<{ kind: string; label?: string; id?: string }>;
    reasons?: Array<{ code: string; params?: Record<string, unknown>; blockers?: Array<{ kind: string; label?: string; id?: string }> }> };
  const reasonOf = (body: Refusal, code: string) => body.reasons?.find((r) => r.code === code) ?? (body.code === code ? body : undefined);

  await t.test('only one concurrent order can take the last unit', async () => {
    const id = await stock(1);
    const results = await Promise.allSettled([orders.create(actor, input(id)), orders.create(actor, input(id))]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(await balance(id), 0);
  });
  await t.test('duplicate lines are checked together and rejected atomically', async () => {
    const id = await stock(3);
    const body = input(id, 2);
    body.items.push({ ...body.items[0] });
    await assert.rejects(orders.create(actor, body));
    assert.equal(await balance(id), 3);
  });
  await t.test('order numbers advance uniquely across concurrent orders', async () => {
    const id = await stock(2);
    const [first, second] = await Promise.all([
      orders.create(actor, input(id)),
      orders.create(actor, input(id)),
    ]);
    assert.notEqual(first.orderNumber, second.orderNumber);
    assert.match(first.orderNumber, /^PM-\d+$/);
    assert.match(second.orderNumber, /^PM-\d+$/);
    await assert.rejects(
      db.query('UPDATE customer_order SET order_number = $1 WHERE id = $2', [first.orderNumber, second.id]),
    );
  });
  await t.test('a linked catalogue imports one product per item with every channel listing, once', async () => {
    const tag = randomUUID().slice(0, 8);
    const file: LinkedProduct[] = [{
      name: `Picnic mat ${tag}`, category: 'HOME', sellingPrice: '900.00', noonStock: 7, warehouseStock: 30,
      listings: [
        { channel: 'noon', externalId: `Z${tag}-1`, partnerSku: `PSKU_${tag}`, title: 'Foldable picnic mat', price: '429.00' },
        { channel: 'amazon', externalId: `AMZ-${tag}`, partnerSku: null, title: 'AYBUY Picnic Blanket', price: '449.00' },
        { channel: 'easyorders', externalId: randomUUID(), partnerSku: `MAT-${tag}`, title: 'مفرش رحلات', price: '900.00' },
      ],
    }];
    assert.deepEqual(validateLinkedCatalog([...file, file[0]]).length > 0, true, 'the same listing twice is refused');
    const dry = await importLinkedCatalog(db, file, { actorId: null, apply: false });
    assert.equal(dry.created, 1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM product WHERE name = $1', [file[0].name]))[0].n, 0, 'a dry run writes nothing');

    const done = await importLinkedCatalog(db, file, { actorId: null, apply: true });
    assert.deepEqual([done.created, done.listings, done.failed.length], [1, 3, 0]);
    const [variant] = await db.query(
      `SELECT v.id, v.sku FROM product_variant v JOIN product p ON p.id = v.product_id WHERE p.name = $1`, [file[0].name]);
    assert.equal(variant.sku, null, 'no SKU of our own');
    const stock = await db.query(
      `SELECT location, SUM(quantity)::int AS n FROM stock_movement WHERE variant_id = $1 GROUP BY location ORDER BY location`, [variant.id]);
    assert.deepEqual(stock, [{ location: 'NOON', n: 7 }, { location: 'WAREHOUSE', n: 30 }]);
    assert.equal(await OrdersService.resolveVariant(db.manager, 'amazon', `AMZ-${tag}`), variant.id);
    // A website order for one of its colours finds the product linked as a whole.
    assert.equal(await OrdersService.resolveVariant(db.manager, 'easyorders', file[0].listings[2].externalId, randomUUID()), variant.id);

    const again = await importLinkedCatalog(db, file, { actorId: null, apply: true });
    assert.deepEqual([again.created, again.skipped.length], [0, 1], 're-running the same file creates nothing twice');
  });
  await t.test('a noon settlement moves stock only for orders after the opening count, from noon first', async () => {
    const tag = randomUUID().slice(0, 8);
    const psku = `PSKU_TEST_${tag}_X`;
    await importLinkedCatalog(db, [{
      name: `Settled ${tag}`, category: null, sellingPrice: '100.00', noonStock: 2, warehouseStock: 5,
      listings: [{ channel: 'noon', externalId: `Z${tag}Z-1`, partnerSku: psku, title: 'Settled item', price: '100.00' }],
    }, {
      // Sold out at the snapshot, so it has no opening count of its own.
      name: `Sold out ${tag}`, category: null, sellingPrice: '50.00', noonStock: 0, warehouseStock: 0,
      listings: [{ channel: 'noon', externalId: `Z${tag}E-1`, partnerSku: `${psku}E`, title: 'Sold out item', price: '50.00' }],
    }], { actorId: null, apply: true, stockAsOf: new Date('2026-10-12T12:23:00+03:00') });
    const [{ id: variantId }] = await db.query(
      `SELECT v.id FROM product_variant v JOIN product p ON p.id = v.product_id WHERE p.name = $1`, [`Settled ${tag}`]);
    const header = 'Contract,Contract Title,Reference Nr,Order Nr,Item Nr,Order Date,Transaction Date,Title,SKUs,Partner SKUs,Transaction Type,Currency,Net Proceeds,Referral Fee including VAT,Fullfilment & Logistics Fees including VAT,Shipping Credits including VAT,Other Order Fees including VAT,Order Subsidies including VAT,Non-Order Fees including VAT,Non-Order Subsidies including VAT,Others including VAT,Total';
    const row = (n: number, ordered: string) =>
      `C1,Noon EG,PS-${tag},N${tag}${n},N${tag}${n}-1,${ordered},2026-10-20,Settled item,Z${tag}Z-1,${psku},order,EGP,100,-10,0,0,0,0,0,0,0,90`;
    const soldOut = `C1,Noon EG,PS-${tag},N${tag}9,N${tag}9-1,2026-10-05,2026-10-20,Sold out item,Z${tag}E-1,${psku}E,order,EGP,50,-5,0,0,0,0,0,0,0,45`;
    const payout = `C1,Noon EG,PS-${tag},,,,2026-10-14,,,,payment,EGP,0,0,0,0,0,0,0,0,-777,-777`;
    const csv = [header, row(1, '2026-10-05'), row(2, '2026-10-13'), row(3, '2026-10-14'), row(4, '2026-10-15'), soldOut, payout].join('\n');
    const noon = new NoonImportService(db, finance);
    const result = await noon.import(`settlement-${tag}.csv`, Buffer.from(csv));
    assert.deepEqual([result.rowsInserted, result.unmappedListings, result.stockMoved, result.stockBeforeOpening], [6, 0, 3, 2]);
    const [{ moved }] = await db.query(
      `SELECT count(*)::int AS moved FROM stock_movement m JOIN channel_listing l ON l.variant_id = m.variant_id
       WHERE l.partner_sku = $1 AND m.source_type = 'noon_transaction'`, [`${psku}E`]);
    assert.equal(moved, 0, 'a product sold out at the snapshot already had its earlier sales netted out');
    const [{ day }] = await db.query(
      `SELECT (occurred_at AT TIME ZONE 'Africa/Cairo')::date::text AS day FROM ledger_entry WHERE kind = 'NOON_PAYOUT' AND amount = 777 ORDER BY created_at DESC LIMIT 1`);
    assert.equal(day, '2026-10-14', 'a payout is dated the day noon sent it');
    const stock = await db.query(
      `SELECT location, SUM(quantity)::int AS n FROM stock_movement WHERE variant_id = $1 GROUP BY location ORDER BY location`, [variantId]);
    assert.deepEqual(stock, [{ location: 'NOON', n: 0 }, { location: 'WAREHOUSE', n: 4 }], 'two from noon, then one from the warehouse; the 5 Oct order left alone');
    const again = await noon.import(`settlement-${tag}.csv`, Buffer.from(csv));
    assert.equal(again.alreadyImported, true, 'the same file twice moves nothing twice');
  });
  await t.test('an Amazon report moves stock by quantity after the opening moment, attributes order fees, and refreshes released money', async () => {
    const tag = randomUUID().slice(0, 8);
    const sku = `AMZ-${tag}`;
    await importLinkedCatalog(db, [{
      name: `Amazon item ${tag}`, category: null, sellingPrice: '100.00', noonStock: 0, warehouseStock: 10,
      listings: [{ channel: 'amazon', externalId: sku, partnerSku: null, title: 'Amazon item', price: '100.00' }],
    }], { actorId: null, apply: true, stockAsOf: new Date('2026-10-12T12:23:00+03:00') });
    const [{ id: variantId, listingId }] = await db.query(
      `SELECT v.id, l.id AS "listingId" FROM product_variant v JOIN product p ON p.id = v.product_id
       JOIN channel_listing l ON l.variant_id = v.id WHERE p.name = $1`, [`Amazon item ${tag}`]);
    const header = '"date/time","settlement id","type","order id","sku","description","quantity","marketplace","fulfillment","order city","order state","order postal","product sales","shipping credits","promotional rebates","selling fees","fba fees","other transaction fees","other","total","Transaction Status","Transaction Release Date"';
    const line = (at: string, type: string, order: string, sku: string, qty: string, sales: string, selling: string, other: string, total: string, status = 'Released') =>
      `"${at}","S1","${type}","${order}","${sku}","${type} ${tag}","${qty}","amazon.eg","Seller","","","","${sales}","0","0","${selling}","0","0","${other}","${total}","${status}","20 Oct 2026 9:00:00 AM UTC"`;
    const rows = (heldStatus: string) => [
      line('12 Oct 2026 8:00:00 AM UTC', 'Order', `A-${tag}`, sku, '2', '200.00', '-20.00', '0', '180.00'), // 11:00 Cairo, before the 12:23 count
      line('12 Oct 2026 10:00:00 AM UTC', 'Order', `B-${tag}`, sku, '3', '300.00', '-30.00', '0', '270.00', heldStatus),
      line('12 Oct 2026 10:00:01 AM UTC', 'Amazon Fees', `B-${tag}`, '', '', '0', '-15.00', '0', '-15.00'),
      line('14 Oct 2026 9:00:00 AM UTC', 'Refund', `B-${tag}`, sku, '1', '-100.00', '10.00', '0', '-90.00'),
      line('15 Oct 2026 9:00:00 AM UTC', 'Transfer', '', '', '', '0', '0', '-500.00', '-500.00'),
      line('15 Oct 2026 10:00:00 AM UTC', 'Order', `C-${tag}`, `UNKNOWN-${tag}`, '1', '50.00', '0', '0', '50.00'),
    ];
    const file = (heldStatus: string) => Buffer.from(['"Includes Amazon Marketplace transactions"', header, ...rows(heldStatus)].join('\n'));
    const amazon = new AmazonImportService(db, finance);
    const reporting = new AmazonReportingService(db);
    const before = await reporting.statement('2026-10-12', '2026-10-15');

    const result = await amazon.import(`amazon-${tag}.csv`, file('Deferred'));
    assert.deepEqual(
      [result.rowsInserted, result.unmappedListings, result.stockMoved, result.stockBeforeOpening],
      [6, 1, 4, 2],
      'three units out and one back after the count; the two sold before it were already counted',
    );
    assert.equal(await balance(variantId), 8);
    const [fee] = await db.query(`SELECT listing_id AS "listingId" FROM amazon_transaction WHERE type = 'Amazon Fees' AND order_id = $1`, [`B-${tag}`]);
    assert.equal(fee.listingId, listingId, "an order's Easy Ship charge belongs to the product it shipped");
    const [payout] = await db.query(`SELECT amount, (occurred_at AT TIME ZONE 'Africa/Cairo')::date::text AS day FROM ledger_entry WHERE kind = 'AMAZON_PAYOUT' AND source_id IN (SELECT fingerprint FROM amazon_transaction WHERE description = $1)`, [`Transfer ${tag}`]);
    assert.deepEqual([payout.amount, payout.day], ['500.00', '2026-10-15']);

    const after = await reporting.statement('2026-10-12', '2026-10-15');
    const delta = (k: 'movement' | 'income' | 'fees' | 'payouts' | 'held') => (Number(after[k]) - Number(before[k])).toFixed(2);
    assert.deepEqual([delta('movement'), delta('income'), delta('fees'), delta('payouts'), delta('held')], ['-105.00', '450.00', '-55.00', '-500.00', '270.00']);

    assert.equal((await amazon.import(`amazon-${tag}.csv`, file('Deferred'))).alreadyImported, true);
    const released = await amazon.import(`amazon-${tag}-later.csv`, file('Released'));
    assert.deepEqual([released.rowsInserted, released.rowsSkipped, released.rowsUpdated, released.stockMoved], [0, 6, 1, 0]);
    assert.equal(await balance(variantId), 8, 'a later download moves nothing twice');
    assert.equal((Number((await reporting.statement('2026-10-12', '2026-10-15')).held) - Number(before.held)).toFixed(2), '0.00', 'released money is no longer held');
  });
  await t.test('a count already holds everything dated before it: old invoices move no stock and no treasury', async () => {
    const sales = new SalesService(db, ledger);
    const tag = randomUUID().slice(0, 8);
    await importLinkedCatalog(db, [{
      name: `Counted ${tag}`, category: null, sellingPrice: '90.00', noonStock: 0, warehouseStock: 10,
      listings: [{ channel: 'amazon', externalId: `CNT-${tag}`, partnerSku: null, title: 'Counted item', price: '90.00' }],
    }], { actorId: null, apply: true, stockAsOf: new Date('2026-10-12T12:23:00+03:00') });
    const [{ id: variantId }] = await db.query(
      `SELECT v.id FROM product_variant v JOIN product p ON p.id = v.product_id WHERE p.name = $1`, [`Counted ${tag}`]);
    const cash = async () => Number(await ledger.balanceOf('CASH'));
    const cost = async () => (await db.query('SELECT unit_cost AS c FROM product_variant WHERE id = $1', [variantId]))[0].c;

    // Entered before the count, so it moved the treasury — the count then holds it.
    const voucher = await finance.recordVoucher({ direction: 'OUT', counter: 'OTHER_EXPENSE', amount: '300', occurredAt: '2026-10-05', userId: user.id });
    const books = await cash();
    try {
      assert.equal((await finance.countCash('5000.00', user.id)).change, (5000 - books).toFixed(2));
      assert.equal((await finance.countCash('5000.00', user.id)).change, '0.00', 'the same count again records nothing');
      const counted = await cash();
      assert.equal(counted, 5000);

      const supplier = await purchasing.createSupplier({ name: `Old supplier ${tag}` });
      const buy = (invoiceDate: string, unitCost: string, payment: 'CASH' | 'CREDIT') => purchasing.createInvoice(
        { supplierId: supplier.id, invoiceDate, payment, lines: [{ variantId, quantity: 5, unitCost }] }, user.id, true);
      const paidCash = await buy('2026-10-01', '40', 'CASH');
      const typo = await buy('2026-10-05', '42', 'CREDIT');
      assert.equal(await balance(variantId), 10, 'goods bought before the opening count are already in it');
      assert.equal(await cost(), '42.0000', 'the latest price before the count is the cost');
      assert.equal((await purchasing.getInvoice(paidCash.id)).beforeOpening, true);
      assert.equal(await cash(), counted, 'paid before the cash count: the treasury already reflects it');
      await purchasing.voidInvoice(typo.id, 'typed twice', user.id);
      assert.equal(await cost(), '40.0000', 'cancelling it falls back to the price before');

      const owed = await buy('2026-10-03', '41', 'CREDIT');
      await purchasing.recordSupplierPayment(supplier.id, '100', undefined, user.id, owed.id, '2026-10-06');
      assert.equal(await cash(), counted, 'an old payment, dated, leaves the treasury alone');
      await purchasing.recordSupplierPayment(supplier.id, '50', undefined, user.id, owed.id);
      assert.equal(await cash(), counted - 50, 'paying today moves it');
      await finance.cancelVoucher(voucher.id, 'wrong amount', user.id);
      assert.equal(await cash(), counted - 50, 'cancelling a record the count already holds leaves the treasury alone');

      await buy(new Date().toISOString().slice(0, 10), '50', 'CREDIT');
      assert.equal(await balance(variantId), 15);
      assert.equal(await cost(), '44.0000', 'the counted units carry the old price into the average: (10×41 + 5×50) / 15');

      const customer = await sales.createCustomer({ name: `Old buyer ${tag}` });
      const sell = async (quantity: number, paid: string) => {
        const draft = await sales.createDraft({ customerId: customer.id, invoiceDate: '2026-10-02', lines: [{ variantId, quantity, unitPrice: '90' }] }, user.id);
        return sales.postInvoice(draft.id, paid, user.id);
      };
      const big = await sell(50, '900');
      assert.equal(big.beforeOpening, true, 'more than is on the shelf today, but sold before the count');
      assert.equal(await balance(variantId), 15);
      assert.equal(await cash(), counted - 50);
      const unpaid = await sell(3, '');
      await sales.voidInvoice(unpaid.id, 'not ours', user.id);
      assert.equal(await balance(variantId), 15, 'voiding returns only what it took');
    } finally {
      // Later tests post cash on past dates; a live count would hold them.
      const live: Array<{ id: string }> = await db.query(
        `SELECT id FROM ledger_entry e WHERE kind = 'CASH_COUNT' AND reverses_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_id = e.id)`);
      for (const { id } of live) await ledger.reverse(id, user.id);
    }
  });
  await t.test('the owners can fix the catalogue by hand: count, move a listing, merge a duplicate', async () => {
    const catalog = new CatalogService(db, finance);
    const tag = randomUUID().slice(0, 8);
    const make = (name: string, noon: number, shelf: number, sku: string) => importLinkedCatalog(db, [{
      name: `${name} ${tag}`, category: null, sellingPrice: null, noonStock: noon, warehouseStock: shelf,
      listings: [{ channel: 'amazon', externalId: `${sku}-${tag}`, partnerSku: null, title: name, price: '10.00' }],
    }], { actorId: null, apply: true });
    await make('Keeper', 1, 4, 'K');
    await make('Duplicate', 2, 3, 'D');
    const variantOf = async (name: string) =>
      (await db.query('SELECT v.id, v.product_id AS "productId" FROM product_variant v JOIN product p ON p.id = v.product_id WHERE p.name = $1', [`${name} ${tag}`]))[0];
    const keeper = await variantOf('Keeper');
    const dup = await variantOf('Duplicate');
    const at = async (variantId: string) => Object.fromEntries((await db.query(
      'SELECT location, SUM(quantity)::int AS n FROM stock_movement WHERE variant_id = $1 GROUP BY location', [variantId])).map((r: { location: string; n: number }) => [r.location, r.n]));

    const counted = await catalog.countStock(keeper.id, 'WAREHOUSE', 9, user.id);
    assert.deepEqual([counted.before, counted.change], [4, 5]);
    assert.equal((await catalog.countStock(keeper.id, 'WAREHOUSE', 9, user.id)).change, 0, 'the same count twice records nothing');

    const [listing] = await db.query('SELECT id FROM channel_listing WHERE variant_id = $1', [dup.id]);
    await catalog.moveListing(listing.id, keeper.id);
    assert.equal(await OrdersService.resolveVariant(db.manager, 'amazon', `D-${tag}`), keeper.id, 'its orders now reach the other product');
    await catalog.moveListing(listing.id, dup.id);

    await catalog.mergeProduct(dup.productId, keeper.id);
    assert.deepEqual(await at(keeper.id), { NOON: 3, WAREHOUSE: 12 }, 'counts and history come along');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM channel_listing WHERE variant_id = $1', [keeper.id]))[0].n, 2);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM product WHERE id = $1', [dup.productId]))[0].n, 0, 'the duplicate is gone');

    const traded = await stock(3);
    await orders.create(actor, input(traded));
    const [{ productId: tradedProduct }] = await db.query('SELECT product_id AS "productId" FROM product_variant WHERE id = $1', [traded]);
    await assert.rejects(catalog.mergeProduct(tradedProduct, keeper.id), refusedWith('product.usedInOrders'), 'a product on an order keeps its history');
  });
  await t.test('status tabs count the filtered orders, and a tab can hold several statuses', async () => {
    const variantId = await stock(2);
    const customerName = `Tabs ${randomUUID()}`;
    const first = await orders.create(actor, { ...input(variantId), customerName });
    await orders.create(actor, { ...input(variantId), customerName });
    await orders.updateStatus(actor, first.id, 'CONFIRMED');
    const summary = await orders.summary(actor, { search: customerName, status: ['NEW'] });
    assert.equal(summary.total, 2, 'a tab never narrows its own counts');
    assert.equal(summary.byStatus.NEW, 1);
    assert.equal(summary.byStatus.CONFIRMED, 1);
    const page = await orders.list(actor, { search: customerName, status: ['NEW', 'CONFIRMED'] });
    assert.equal(page.total, 2);
    assert.equal((await orders.list(actor, { search: customerName, paymentStatus: 'PAID' })).total, 0);
  });
  await t.test('a returning customer is found by phone, however the number is written', async () => {
    const variantId = await stock(2);
    const phone = `010${String(Date.now()).slice(-8)}`;
    await orders.create(actor, { ...input(variantId), customerName: 'Returning one', customerPhone: phone, address: 'First street' });
    await orders.create(actor, { ...input(variantId), customerName: 'Returning two', customerPhone: `+2${phone}`, address: 'Second street' });
    const found = await orders.customerByPhone(actor, `2${phone}`);
    assert.equal(found?.name, 'Returning two', 'the latest order wins');
    assert.equal(found?.address, 'Second street');
    assert.equal(found?.orders, 2);
    assert.equal(await orders.customerByPhone(actor, '0100'), null);
  });
  await t.test('empty later pages retain their filtered totals', async () => {
    const variantId = await stock(1);
    const customerName = `Pagination ${randomUUID()}`;
    await orders.create(actor, { ...input(variantId), customerName });
    const orderPage = await orders.list(actor, { search: customerName, limit: 20, offset: 20 });
    assert.equal(orderPage.orders.length, 0);
    assert.equal(orderPage.total, 1);

    const sourceId = randomUUID();
    await ledger.post({
      amount: '1',
      debit: 'CASH',
      credit: 'OWNER_CAPITAL',
      kind: 'CASH_DEPOSIT',
      sourceType: 'pagination-test',
      sourceId,
    });
    const ledgerPage = await ledger.entries({ sourceType: 'pagination-test', sourceId, limit: 30, offset: 30 });
    assert.equal(ledgerPage.entries.length, 0);
    assert.equal(ledgerPage.total, 1);
  });
  await t.test('moderators see only shipments assigned to them', async () => {
    const moderator = await db.getRepository(User).save({
      email: `moderator-${randomUUID()}@example.invalid`,
      name: 'Shipment moderator',
      passwordHash: 'unused',
      role: 'MODERATOR',
    });
    const variantId = await stock(2);
    const ownOrder = await orders.create(actor, { ...input(variantId), customerName: 'Assigned shipment' });
    const otherOrder = await orders.create(actor, { ...input(variantId), customerName: 'Other shipment' });
    await db.getRepository(Order).update(ownOrder.id, {
      assignedToId: moderator.id,
      trackingNumber: 'ASSIGNED-TRACKING',
    });
    await db.getRepository(Order).update(otherOrder.id, {
      assignedToId: user.id,
      trackingNumber: 'OTHER-TRACKING',
    });

    const deliveries: BostaDeliveryRaw[] = [
      { trackingNumber: 'ASSIGNED-TRACKING', state: { value: 'In transit', code: 30 }, receiver: { fullName: 'Assigned customer' } },
      { trackingNumber: 'OTHER-TRACKING', state: { value: 'In transit', code: 30 }, receiver: { fullName: 'Other customer' } },
    ];
    const client = {
      listDeliveries: async () => deliveries,
      getDelivery: async (trackingNumber: string) =>
        deliveries.find((delivery) => delivery.trackingNumber === trackingNumber) ?? null,
    };
    const bosta = new BostaService(client as never, db);
    const moderatorActor = {
      id: moderator.id,
      name: moderator.name,
      role: 'MODERATOR' as const,
      email: moderator.email,
    };

    assert.deepEqual(
      (await bosta.listDeliveries(moderatorActor)).map((delivery) => delivery.trackingNumber),
      ['ASSIGNED-TRACKING'],
    );
    assert.equal((await bosta.listDeliveries(actor)).length, 2);
    assert.equal((await bosta.trackForUser(moderatorActor, 'ASSIGNED-TRACKING'))?.receiver.name, 'Assigned customer');
    assert.equal(await bosta.trackForUser(moderatorActor, 'OTHER-TRACKING'), null);
  });
  await t.test('concurrent Easy Orders deliveries create and process one order', async () => {
    const externalId = randomUUID();
    const payload = {
      id: externalId,
      full_name: 'Webhook customer',
      phone: '01012345678',
      cost: 50,
      shipping_cost: 10,
      total_cost: 60,
      cart_items: [{ id: randomUUID(), quantity: 1, price: 50, product: { name: 'Webhook item' } }],
    };
    const results = await Promise.all([
      easyOrders.ingest(payload),
      easyOrders.ingest(payload),
      easyOrders.ingest({ ...payload, full_name: 'Webhook customer updated' }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), ['created', 'duplicate', 'duplicate']);
    assert.equal(Number((await db.query(
      "SELECT count(*) AS n FROM customer_order WHERE source = 'EASYORDERS' AND external_id = $1",
      [externalId],
    ))[0].n), 1);
    const eventRows = await db.query(
      'SELECT processed_at AS "processedAt", error FROM easyorders_event WHERE external_order_id = $1',
      [externalId],
    );
    assert.equal(eventRows.length, 2);
    assert.ok(eventRows.every((event: { processedAt: Date | null; error: string | null }) =>
      event.processedAt && event.error === null));
  });
  await t.test('an early Easy Orders status retries and late paid cannot undo a refund', async () => {
    const externalId = randomUUID();
    const paid = { event_type: 'order-status', order_id: externalId, new_status: 'paid' };
    await assert.rejects(easyOrders.ingest(paid));
    const [failed] = await db.query(
      'SELECT processed_at AS "processedAt", error FROM easyorders_event WHERE external_order_id = $1',
      [externalId],
    );
    assert.equal(failed.processedAt, null);
    assert.match(failed.error, /before its order/);

    const created = await easyOrders.ingest({
      id: externalId,
      full_name: 'Retry customer',
      phone: '01012345678',
      total_cost: 40,
      cart_items: [{ id: randomUUID(), quantity: 1, price: 40, product: { name: 'Retry item' } }],
    });
    assert.equal((await easyOrders.ingest(paid)).status, 'updated');
    const [retried] = await db.query(
      "SELECT processed_at AS \"processedAt\", error FROM easyorders_event WHERE external_order_id = $1 AND event_type = 'order-status'",
      [externalId],
    );
    assert.ok(retried.processedAt);
    assert.equal(retried.error, null);

    await orders.updateStatus(actor, created.orderId!, 'CONFIRMED');
    await orders.updateStatus(actor, created.orderId!, 'SHIPPED');
    const returned = await orders.updateStatus(actor, created.orderId!, 'RETURNED', {
      reason: 'Customer returned the parcel', restock: false,
    });
    assert.equal(returned.paymentStatus, 'REFUND_DUE');
    await easyOrders.ingest({ ...paid, old_status: 'late-after-return' });
    assert.equal((await db.getRepository(Order).findOneByOrFail({ id: created.orderId })).paymentStatus, 'REFUND_DUE');
    assert.equal(Number((await db.query(
      "SELECT count(*) AS n FROM ledger_entry WHERE source_id = $1 AND kind = 'ORDER_SALE'",
      [created.orderId],
    ))[0].n), 1);
  });
  await t.test('invalid Easy Orders quantities preserve a visible failed delivery', async () => {
    const externalId = randomUUID();
    await assert.rejects(easyOrders.ingest({
      id: externalId,
      cart_items: [{ id: randomUUID(), quantity: 0, price: 10, product: { name: 'Invalid item' } }],
    }));
    const [event] = await db.query(
      'SELECT processed_at AS "processedAt", error FROM easyorders_event WHERE external_order_id = $1',
      [externalId],
    );
    assert.equal(event.processedAt, null);
    assert.match(event.error, /positive integer/);
    assert.equal(Number((await db.query(
      "SELECT count(*) AS n FROM customer_order WHERE source = 'EASYORDERS' AND external_id = $1",
      [externalId],
    ))[0].n), 0);

    const invalidAmountId = randomUUID();
    await assert.rejects(easyOrders.ingest({
      id: invalidAmountId,
      total_cost: -1,
      cart_items: [{ id: randomUUID(), quantity: 1, price: 10, product: { name: 'Invalid total' } }],
    }));
    assert.equal(Number((await db.query(
      "SELECT count(*) AS n FROM customer_order WHERE source = 'EASYORDERS' AND external_id = $1",
      [invalidAmountId],
    ))[0].n), 0);
  });
  await t.test('concurrent payment and cancellation requests post exactly once', async () => {
    const id = await stock(1);
    const order = await orders.create(actor, input(id));
    await Promise.all([orders.updatePayment(actor, order.id, 'PAID'), orders.updatePayment(actor, order.id, 'PAID')]);
    assert.equal(Number((await db.query("SELECT count(*) AS n FROM ledger_entry WHERE source_id = $1 AND kind = 'ORDER_SALE'", [order.id]))[0].n), 1);
    await assert.rejects(orders.update(actor, order.id, input(id)));
    await Promise.all([orders.updateStatus(actor, order.id, 'CANCELLED'), orders.updateStatus(actor, order.id, 'CANCELLED')]);
    assert.equal(await balance(id), 1);
  });
  await t.test('bulk assignment is authorized, validated and atomic', async () => {
    const moderator = await db.getRepository(User).save({
      email: `bulk-${randomUUID()}@example.invalid`, name: 'Bulk moderator', passwordHash: 'unused', role: 'MODERATOR',
    });
    const inactive = await db.getRepository(User).save({
      email: `inactive-${randomUUID()}@example.invalid`, name: 'Inactive moderator', passwordHash: 'unused',
      role: 'MODERATOR', active: false,
    });
    const id = await stock(2);
    const first = await orders.create(actor, input(id));
    const second = await orders.create(actor, input(id));

    const result = await orders.bulkAssign([second.id, first.id, first.id], moderator.id, actor);
    assert.deepEqual(result, { updated: 2, selected: 2 });
    const assigned = await db.query(
      'SELECT id, assigned_to_id AS "assignedToId", status FROM customer_order WHERE id = ANY($1) ORDER BY id',
      [[first.id, second.id]],
    );
    assert.ok(assigned.every((order: { assignedToId: string; status: string }) =>
      order.assignedToId === moderator.id && order.status === 'ASSIGNED'));
    assert.equal(Number((await db.query(
      "SELECT count(*) AS n FROM order_event WHERE order_id = ANY($1) AND type = 'ASSIGNED'",
      [[first.id, second.id]],
    ))[0].n), 2);
    assert.equal((await orders.bulkAssign([first.id, second.id], moderator.id, actor)).updated, 0);

    await assert.rejects(orders.bulkAssign([first.id, randomUUID()], null, actor));
    assert.equal((await db.getRepository(Order).findOneByOrFail({ id: first.id })).assignedToId, moderator.id);
    await assert.rejects(orders.bulkAssign([first.id], inactive.id, actor));
    await assert.rejects(orders.bulkAssign([first.id], null, { ...actor, role: 'MODERATOR' }));
  });
  for (const restock of [true, false]) {
    await t.test(`paid return preserves cash until refund; restock=${restock}`, async () => {
      const id = await stock(2);
      const order = await orders.create(actor, input(id));
      const cashBefore = Number(await ledger.balanceOf('CASH'));
      const revenueBefore = Number(await ledger.balanceOf('SALES'));
      await orders.updatePayment(actor, order.id, 'PAID');
      await assert.rejects(orders.updateStatus(actor, order.id, 'RETURNED'));
      const returned = await orders.updateStatus(actor, order.id, 'RETURNED', { reason: 'Customer return', restock });
      assert.equal(returned.paymentStatus, 'REFUND_DUE');
      assert.equal(await balance(id), restock ? 2 : 1);
      assert.equal(Number(await ledger.balanceOf('CASH')), cashBefore + 20);
      assert.equal(Number(await ledger.balanceOf('SALES')), revenueBefore);
      await orders.updateStatus(actor, order.id, 'RETURNED', { reason: 'retry', restock });
      assert.equal(await balance(id), restock ? 2 : 1);
      await assert.rejects(orders.updateStatus(actor, order.id, 'NEW'));
      await assert.rejects(orders.updatePayment(actor, order.id, 'PAID'));
      await Promise.all([orders.updatePayment(actor, order.id, 'REFUNDED'), orders.updatePayment(actor, order.id, 'REFUNDED')]);
      assert.equal(Number(await ledger.balanceOf('CASH')), cashBefore);
      assert.equal(Number((await db.query("SELECT COALESCE(SUM(CASE WHEN credit_code = 'CUSTOMER_REFUNDS' THEN amount WHEN debit_code = 'CUSTOMER_REFUNDS' THEN -amount ELSE 0 END), 0) AS n FROM ledger_entry WHERE source_id = $1", [order.id]))[0].n), 0);
      assert.equal(await balance(id), restock ? 2 : 1);
    });
  }
  await t.test('business profit snapshots shipping and reverses the original measure', async () => {
    const [{ today }] = await db.query("SELECT (now() AT TIME ZONE 'Africa/Cairo')::date::text AS today");
    const before = await ledger.businessProfit(today, today, 'day');

    const legacy = await ledger.post({
      amount: '99.00', debit: 'CASH', credit: 'SALES', kind: 'ORDER_SALE',
      sourceType: 'order', sourceId: randomUUID(),
    });
    const withLegacy = await ledger.businessProfit(today, today, 'day');
    assert.equal(withLegacy.sales, before.sales);
    assert.equal(withLegacy.businessProfit, before.businessProfit);
    assert.equal(withLegacy.unreconciledEntries, before.unreconciledEntries + 1);
    await ledger.reverse(legacy.id);

    const id = await stock(1);
    const order = await orders.create(actor, { ...input(id), shippingCost: '5.00' });
    await orders.updatePayment(actor, order.id, 'PAID');
    const paid = await ledger.businessProfit(today, today, 'day');
    assert.equal(Number(paid.sales), Number(before.sales) + 25);
    assert.equal(Number(paid.shipping), Number(before.shipping) + 5);
    assert.equal(Number(paid.businessProfit), Number(before.businessProfit) + 20);

    await orders.updateStatus(actor, order.id, 'CONFIRMED');
    await orders.updateStatus(actor, order.id, 'SHIPPED');
    await orders.updateStatus(actor, order.id, 'RETURNED', { reason: 'Profit reversal test', restock: true });
    const returned = await ledger.businessProfit(today, today, 'day');
    assert.equal(returned.sales, before.sales);
    assert.equal(returned.shipping, before.shipping);
    assert.equal(returned.businessProfit, before.businessProfit);
  });
  await t.test('moderators cannot cancel, and shipped goods require a received return', async () => {
    const id = await stock(2);
    const moderator = { ...actor, role: 'MODERATOR' as const };
    const order = await orders.create(moderator, input(id));
    await assert.rejects(orders.updateStatus(moderator, order.id, 'CANCELLED'));
    await orders.updateStatus(actor, order.id, 'SHIPPED');
    await assert.rejects(orders.updateStatus(actor, order.id, 'CANCELLED'));
    assert.equal(await balance(id), 1);
  });
  await t.test('warehouse transfers conserve stock and Noon stock cannot fill manual orders', async () => {
    const catalog = new CatalogService(db, finance);
    const id = await stock(5);
    const beforeValue = (await finance.overview()).stockValue;
    await catalog.transferStock(id, 4, 'WAREHOUSE', 'NOON', user.id, 'Test transfer');
    assert.equal(await balance(id), 5);
    assert.equal((await finance.overview()).stockValue, beforeValue);
    await assert.rejects(orders.create(actor, input(id, 2)));
    await assert.rejects(catalog.transferStock(id, 2, 'WAREHOUSE', 'NOON', user.id));
    const competing = await Promise.allSettled([
      catalog.transferStock(id, 1, 'WAREHOUSE', 'NOON', user.id),
      orders.create(actor, input(id)),
    ]);
    assert.equal(competing.filter((r) => r.status === 'fulfilled').length, 1);
    const grouped = await db.query("SELECT source_id, SUM(quantity)::int AS total FROM stock_movement WHERE variant_id = $1 AND reason = 'TRANSFER' GROUP BY source_id", [id]);
    assert.ok(grouped.every((r: { total: number }) => r.total === 0));
    await assert.rejects(catalog.recordStock(id, -1, 'PURCHASE', user.id));
    await assert.rejects(catalog.recordStock(id, 1, 'DAMAGE', user.id));
  });
  await t.test('manual stock corrections have valid directions and balanced value entries', async () => {
    const catalog = new CatalogService(db, finance);
    const id = await stock(5);
    const inventoryBefore = Number(await ledger.balanceOf('INVENTORY'));
    const adjustmentBefore = Number(await ledger.balanceOf('INVENTORY_ADJUSTMENT'));

    await assert.rejects(catalog.recordStock(id, 1, 'PURCHASE', user.id));
    await assert.rejects(catalog.recordStock(id, -1, 'RETURN', user.id));
    await assert.rejects(catalog.recordStock(id, 1, 'DAMAGE', user.id));
    await assert.rejects(catalog.recordStock(id, -1, 'SALE', user.id));
    assert.equal(await balance(id), 5);

    await catalog.recordStock(id, -2, 'DAMAGE', user.id, 'Broken during handling');
    assert.equal(await balance(id), 3);
    assert.equal(Number(await ledger.balanceOf('INVENTORY')), inventoryBefore - 20);
    assert.equal(Number(await ledger.balanceOf('INVENTORY_ADJUSTMENT')), adjustmentBefore + 20);

    await catalog.recordStock(id, 1, 'RETURN', user.id, 'External customer return');
    assert.equal(await balance(id), 4);
    assert.equal(Number(await ledger.balanceOf('INVENTORY')), inventoryBefore - 10);
    assert.equal(Number(await ledger.balanceOf('INVENTORY_ADJUSTMENT')), adjustmentBefore + 10);
  });
  await t.test('average-cost corrections require a reason and revalue current stock', async () => {
    const catalog = new CatalogService(db, finance);
    const id = await stock(5);
    const inventoryBefore = Number(await ledger.balanceOf('INVENTORY'));
    const adjustmentBefore = Number(await ledger.balanceOf('INVENTORY_ADJUSTMENT'));

    await assert.rejects(catalog.updateVariant(id, { unitCost: '12.0000' }, user.id));
    assert.equal((await db.getRepository(ProductVariant).findOneByOrFail({ id })).unitCost, '10.0000');

    await catalog.updateVariant(
      id,
      { unitCost: '12.0000', costReason: 'Corrected supplier invoice' },
      user.id,
    );
    assert.equal((await db.getRepository(ProductVariant).findOneByOrFail({ id })).unitCost, '12.0000');
    assert.equal(Number(await ledger.balanceOf('INVENTORY')), inventoryBefore + 10);
    assert.equal(Number(await ledger.balanceOf('INVENTORY_ADJUSTMENT')), adjustmentBefore - 10);

    const [movement] = await db.query(
      `SELECT quantity, unit_cost AS "unitCost", avg_cost_after AS "avgCostAfter", note
       FROM stock_movement WHERE variant_id = $1 AND source_type = 'cost_correction'
       ORDER BY created_at DESC LIMIT 1`,
      [id],
    );
    assert.equal(movement.quantity, 0);
    assert.equal(movement.unitCost, '12.0000');
    assert.equal(movement.avgCostAfter, '12.0000');
    assert.match(movement.note, /Corrected supplier invoice/);
  });
  await t.test('archiving cannot hide stock, open work, listings or draft purchases', async () => {
    const catalog = new CatalogService(db, finance);

    const stockedId = await stock(1);
    const stocked = await db.getRepository(ProductVariant).findOneByOrFail({ id: stockedId });
    await assert.rejects(catalog.archiveProduct(stocked.productId));
    assert.equal((await db.getRepository(Product).findOneByOrFail({ id: stocked.productId })).active, true);

    const orderedId = await stock(1);
    const ordered = await db.getRepository(ProductVariant).findOneByOrFail({ id: orderedId });
    const order = await orders.create(actor, input(orderedId));
    assert.equal(await balance(orderedId), 0);
    await assert.rejects(catalog.archiveProduct(ordered.productId));

    const listed = await emptyProduct();
    await catalog.addListing(listed.product.id, {
      channel: 'easyorders',
      externalId: randomUUID(),
    });
    await assert.rejects(catalog.archiveProduct(listed.product.id));

    const drafted = await emptyProduct();
    const supplier = await purchasing.createSupplier({ name: `Archive supplier ${randomUUID()}` });
    await purchasing.createInvoice({
      supplierId: supplier.id,
      invoiceDate: '2026-09-17',
      payment: 'CREDIT',
      lines: [{ variantId: drafted.variant.id, quantity: 1, unitCost: '10.00' }],
    }, user.id);
    await assert.rejects(catalog.archiveProduct(drafted.product.id));

    await orders.updateStatus(actor, order.id, 'DELIVERED');
    await catalog.archiveProduct(ordered.productId);
    assert.equal((await db.getRepository(ProductVariant).findOneByOrFail({ id: orderedId })).active, false);
    await assert.rejects(catalog.recordStock(orderedId, 1, 'ADJUSTMENT', user.id));
    await assert.rejects(catalog.updateVariant(orderedId, { sellingPrice: '20.00' }, user.id));
    await assert.rejects(purchasing.createInvoice({
      supplierId: supplier.id,
      invoiceDate: '2026-09-17',
      payment: 'CREDIT',
      lines: [{ variantId: orderedId, quantity: 1, unitCost: '10.00' }],
    }, user.id));

    const competing = await emptyProduct();
    const race = await Promise.allSettled([
      catalog.archiveProduct(competing.product.id),
      catalog.recordStock(competing.variant.id, 1, 'ADJUSTMENT', user.id, 'Concurrent count'),
    ]);
    assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1);
    const competingActive = (await db.getRepository(Product).findOneByOrFail({ id: competing.product.id })).active;
    assert.equal(await balance(competing.variant.id), competingActive ? 1 : 0);

    await orders.updateStatus(actor, order.id, 'RETURNED', {
      reason: 'Sellable return after product was archived',
      restock: true,
    });
    assert.equal(await balance(orderedId), 1);
    assert.equal((await db.getRepository(Product).findOneByOrFail({ id: ordered.productId })).active, true);
    assert.equal((await db.getRepository(ProductVariant).findOneByOrFail({ id: orderedId })).active, true);
  });
  await t.test('custom expenses deduplicate requests and reverse without deleting history', async () => {
    const expenses = new ExpensesService(db, ledger);
    const cash = Number(await ledger.balanceOf('CASH'));
    const body = { requestId: randomUUID(), amount: '25.50', category: '  Custom ads  ', spentOn: '2026-09-16', note: 'Test' };
    const [a, b] = await Promise.all([expenses.create(body, user.id), expenses.create(body, user.id)]);
    assert.equal(a.id, b.id);
    assert.equal(Number(await ledger.balanceOf('CASH')), cash - 25.5);
    await assert.rejects(expenses.create({ ...body, amount: '30' }, user.id));
    await expenses.create({ ...body, requestId: randomUUID(), category: 'custom ads' }, user.id);
    assert.equal((await expenses.categories()).filter((c) => c.key === 'custom ads').length, 1);
    await Promise.all([expenses.void(a.id, 'Entered by mistake', user.id), expenses.void(a.id, 'retry', user.id)]);
    assert.equal(Number(await ledger.balanceOf('CASH')), cash - 25.5);
    const history = await ledger.entries({ sourceType: 'expense', sourceId: a.id });
    assert.equal(history.total, 2);
    assert.ok(history.entries.some((e: { reversesId: string | null }) => e.reversesId));
    await assert.rejects(expenses.create({ ...body, requestId: randomUUID(), spentOn: '2026-02-30' }, user.id));
  });
  await t.test('a ledger entry can only be reversed once', async () => {
    const entry = await ledger.post({ amount: '10', debit: 'CASH', credit: 'OWNER_CAPITAL', kind: 'CASH_DEPOSIT' });
    const [a, b] = await Promise.all([ledger.reverse(entry.id), ledger.reverse(entry.id)]);
    assert.equal(a.id, b.id);
  });
  await t.test('landed costs preserve precision and separately paid costs are not owed to supplier', async () => {
    const id = await stock(3);
    const supplier = await purchasing.createSupplier({ name: 'Landed-cost supplier' });
    const cash = Number(await ledger.balanceOf('CASH'));
    const inv = await purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: '2026-09-16', payment: 'CREDIT',
      extraCosts: '1.00', extraCostsPaidSeparately: true, allocation: 'PER_UNIT', lines: [{ variantId: id, quantity: 3, unitCost: '10.00' }] }, user.id, true);
    assert.equal(inv.status, 'POSTED');
    assert.equal(inv.lines[0].landedUnitCost, '10.3333');
    assert.equal((await db.getRepository(ProductVariant).findOneByOrFail({ id })).unitCost, '10.1667');
    assert.equal((await purchasing.supplierDetail(supplier.id)).balance, '30.00');
    assert.equal(await ledger.balanceOf('SUPPLIER_PAYABLE', { supplierId: supplier.id }), '30.00');
    assert.equal(Number(await ledger.balanceOf('CASH')), cash - 1);
    assert.equal(inv.payableTotal, '30.00');
    assert.equal(inv.settledAmount, '0.00');
    assert.equal(inv.paidStatus, 'UNPAID');
    const listed = (await purchasing.listSuppliers()).find((s) => s.id === supplier.id)!;
    assert.deepEqual([listed.bought, listed.invoiceCount, listed.lastInvoiceAt], ['30.00', 1, '2026-09-16'], 'the separately paid cost was never billed by them');
    await purchasing.recordSupplierPayment(supplier.id, '10.00', undefined, user.id, inv.id);
    const partiallyPaid = await purchasing.getInvoice(inv.id);
    assert.equal(partiallyPaid.settledAmount, '10.00');
    assert.equal(partiallyPaid.payableTotal, '30.00');
    assert.equal(partiallyPaid.paidStatus, 'PARTIAL');
    assert.equal((await purchasing.supplierDetail(supplier.id)).balance, '20.00');
    await assert.rejects(purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: '2026-09-16', payment: 'CREDIT', allocation: 'INVALID' as never, lines: [{ variantId: id, quantity: 1, unitCost: '1.00' }] }, user.id));
  });
  await t.test('an invoice is received once and cannot be overpaid concurrently', async () => {
    const id = await stock(1);
    const supplier = await purchasing.createSupplier({ name: 'Test supplier' });
    const invoice = await purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: '2026-09-16', payment: 'CREDIT', lines: [{ variantId: id, quantity: 2, unitCost: '10' }] }, user.id);
    const posted = await Promise.allSettled([purchasing.postInvoice(invoice.id, user.id), purchasing.postInvoice(invoice.id, user.id)]);
    assert.equal(posted.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(await balance(id), 3);
    const paid = await Promise.allSettled([purchasing.recordSupplierPayment(supplier.id, '20', undefined, user.id), purchasing.recordSupplierPayment(supplier.id, '20', undefined, user.id)]);
    assert.equal(paid.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await purchasing.supplierDetail(supplier.id)).balance, '0.00');
    assert.equal(await ledger.balanceOf('SUPPLIER_PAYABLE', { supplierId: supplier.id }), '0.00');
  });
  await t.test('a resent purchase submission creates one invoice, one receipt and one entry', async () => {
    const id = await stock(0);
    const supplier = await purchasing.createSupplier({ name: `Resend supplier ${randomUUID()}` });
    const requestId = randomUUID();
    const body = { requestId, supplierId: supplier.id, invoiceDate: '2026-10-12', payment: 'CASH' as const,
      lines: [{ variantId: id, quantity: 4, unitCost: '25.00' }] };
    const sent = await Promise.all([purchasing.createInvoice(body, user.id, true), purchasing.createInvoice(body, user.id, true)]);
    assert.equal(sent[0].id, sent[1].id);
    assert.equal((await purchasing.createInvoice(body, user.id, true)).id, sent[0].id);
    assert.equal(await balance(id), 4);
    const [{ n }] = await db.query("SELECT count(*)::int AS n FROM ledger_entry WHERE source_type = 'purchase_invoice' AND source_id = $1", [sent[0].id]);
    assert.equal(n, 1);
  });
  await t.test('a resent order submission creates one order and moves stock once', async () => {
    const id = await stock(5);
    const requestId = randomUUID();
    const body = { ...input(id, 2), requestId };
    const sent = await Promise.all([orders.create(actor, body), orders.create(actor, body)]);
    assert.equal(sent[0].id, sent[1].id);
    assert.equal(await balance(id), 3);
    const other = await db.getRepository(User).save({ email: `other-${Date.now()}@example.invalid`, name: 'Other', passwordHash: 'unused', role: 'MODERATOR' });
    await assert.rejects(orders.create({ id: other.id, name: other.name, role: 'MODERATOR', email: other.email }, body));
    assert.equal(await balance(id), 3);
  });
  await t.test('a typed line total is the amount owed, received and booked exactly', async () => {
    const id = await stock(0);
    const supplier = await purchasing.createSupplier({ name: `Total supplier ${randomUUID()}` });
    const invoice = await purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: '2026-10-12', payment: 'CREDIT',
      lines: [{ variantId: id, quantity: 3, lineTotal: '100' }] }, user.id, true);
    assert.equal(invoice.goodsTotal, '100.00');
    assert.equal(invoice.lines[0].unitCost, '33.3333');
    assert.equal(invoice.lines[0].lineTotal, '100.00');
    assert.equal((await purchasing.supplierDetail(supplier.id)).balance, '100.00');
    assert.equal(await ledger.balanceOf('SUPPLIER_PAYABLE', { supplierId: supplier.id }), '100.00');
    assert.equal(await balance(id), 3);
    const [variant] = await db.query('SELECT unit_cost FROM product_variant WHERE id = $1', [id]);
    assert.equal(variant.unit_cost, '33.3333');
    // A typed unit cost with four decimals rounds the line, never the other way round.
    const byUnit = await purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: '2026-10-12', payment: 'CREDIT',
      lines: [{ variantId: id, quantity: 3, unitCost: '33.3333' }] }, user.id);
    assert.equal(byUnit.lines[0].lineTotal, '100.00');
    await assert.rejects(purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: '2026-10-12', payment: 'CREDIT',
      lines: [{ variantId: id, quantity: 3, lineTotal: '100.001' }] }, user.id));
  });
  await t.test('moderators searching products never receive their cost', async () => {
    const { product } = await emptyProduct();
    const controller = new CatalogController(new CatalogService(db, finance));
    const as = (role: 'ADMIN' | 'MODERATOR') => ({ user: { ...actor, role } }) as unknown as Request;
    const [forModerator] = await controller.searchVariants(as('MODERATOR'), product.name);
    const [forAdmin] = await controller.searchVariants(as('ADMIN'), product.name);
    assert.equal(forModerator.unitCost, null);
    assert.equal(forModerator.lastPurchasePrice, null);
    assert.equal(forAdmin.unitCost, '10.0000');
  });
  await t.test('suppliers archive only when settled, and delete only when never used', async () => {
    const id = await stock(0);
    const owing = await purchasing.createSupplier({ name: `Owing ${randomUUID()}` });
    await purchasing.createInvoice({ supplierId: owing.id, invoiceDate: '2026-10-12', payment: 'CREDIT',
      lines: [{ variantId: id, quantity: 1, unitCost: '50' }] }, user.id, true);
    await assert.rejects(purchasing.updateSupplier(owing.id, { active: false }), refusedWith('supplier.archiveOwed'));
    await assert.rejects(purchasing.deleteSupplier(owing.id), refusedWith('supplier.hasInvoices'));
    await purchasing.recordSupplierPayment(owing.id, '50', undefined, user.id);
    await purchasing.updateSupplier(owing.id, { active: false });
    assert.ok((await purchasing.listSuppliers(true)).some((sup) => sup.id === owing.id));
    assert.ok(!(await purchasing.listSuppliers()).some((sup) => sup.id === owing.id));
    await purchasing.updateSupplier(owing.id, { active: true });

    const drafting = await purchasing.createSupplier({ name: `Drafting ${randomUUID()}` });
    await purchasing.createInvoice({ supplierId: drafting.id, invoiceDate: '2026-10-12', payment: 'CREDIT',
      lines: [{ variantId: id, quantity: 1, unitCost: '5' }] }, user.id);
    await assert.rejects(purchasing.updateSupplier(drafting.id, { active: false }), refusedWith('supplier.archiveDrafts'));

    const mistake = await purchasing.createSupplier({ name: `Mistake ${randomUUID()}` });
    await purchasing.updateSupplier(mistake.id, { name: 'Corrected name', phone: '01000000000' });
    await purchasing.deleteSupplier(mistake.id);
    await assert.rejects(purchasing.supplierDetail(mistake.id));
  });
  await t.test('a product is restored from the archive, and deleted while it was never traded', async () => {
    const catalog = new CatalogService(db, finance);
    const unused = await catalog.createProduct({ name: `Unused ${randomUUID()}` }, user.id);
    assert.equal((await catalog.getProduct(unused.id)).deletable, true);
    await catalog.archiveProduct(unused.id);
    assert.ok((await catalog.listProducts({ archived: true, search: 'Unused' })).some((p: { id: string }) => p.id === unused.id));
    await catalog.restoreProduct(unused.id);
    assert.equal((await catalog.getProduct(unused.id)).active, true);
    await catalog.deleteProduct(unused.id, user.id);
    await assert.rejects(catalog.getProduct(unused.id));

    // Counted by hand but never bought, sold or listed: a mistake, deletable —
    // and the stock value its corrections booked is reversed, not lost.
    const counted = await catalog.createProduct({ name: `Counted ${randomUUID()}`, openingStock: 2, unitCost: '10' }, user.id);
    await catalog.recordStock(counted.variantId, 3, 'COUNT', user.id, 'recount');
    const movementIds = (await db.query('SELECT id FROM stock_movement WHERE variant_id = $1', [counted.variantId])).map((m: { id: string }) => m.id);
    assert.equal((await catalog.getProduct(counted.id)).deletable, true);
    await catalog.deleteProduct(counted.id, user.id);
    await assert.rejects(catalog.getProduct(counted.id));
    const [{ net, n }] = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN debit_code = 'INVENTORY' THEN amount ELSE -amount END), 0)::numeric(14,2) AS net, count(*)::int AS n
       FROM ledger_entry WHERE source_type = 'stock_movement' AND source_id = ANY($1::text[])`, [movementIds]);
    assert.equal(n, 2); // the 30.00 correction and its reversal
    assert.equal(net, '0.00');

    // Sold once: part of the trading history, archive only.
    const sold = await stock(2);
    await orders.create(actor, input(sold));
    const soldProduct = (await db.query('SELECT product_id AS id FROM product_variant WHERE id = $1', [sold]))[0].id;
    assert.equal((await catalog.getProduct(soldProduct)).deletable, false);
    await assert.rejects(catalog.deleteProduct(soldProduct, user.id), refusedWith('product.usedInOrders', (b) => {
      assert.match(reasonOf(b, 'product.usedInOrders')!.blockers![0].label!, /^PM-\d+$/); // names the order, to open it
    }));
  });
  await t.test('a draft invoice is edited freely and posts what was last saved; a posted one is locked', async () => {
    const id = await stock(0);
    const supplier = await purchasing.createSupplier({ name: `Editing ${randomUUID()}` });
    const draft = await purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: '2026-10-12', payment: 'CREDIT',
      lines: [{ variantId: id, quantity: 10, unitCost: '1' }] }, user.id);
    const edited = await purchasing.updateDraft(draft.id, { supplierId: supplier.id, invoiceNo: 'S-9', invoiceDate: '2026-10-11', payment: 'CREDIT',
      lines: [{ variantId: id, quantity: 3, lineTotal: '100' }] });
    assert.equal(edited.goodsTotal, '100.00');
    assert.equal(edited.lines.length, 1);
    assert.equal(await balance(id), 0); // a draft moves nothing
    await purchasing.postInvoice(draft.id, user.id);
    assert.equal(await balance(id), 3);
    assert.equal(await ledger.balanceOf('SUPPLIER_PAYABLE', { supplierId: supplier.id }), '100.00');
    await assert.rejects(purchasing.updateDraft(draft.id, { supplierId: supplier.id, invoiceDate: '2026-10-11', payment: 'CREDIT',
      lines: [{ variantId: id, quantity: 1, unitCost: '1' }] }), /cannot be edited/);
  });
  await t.test('last and average purchase prices come from posted invoices at the supplier price', async () => {
    const catalog = new CatalogService(db, finance);
    const name = `Priced ${randomUUID()}`;
    const created = await catalog.createProduct({ name, sku: `SKU-${randomUUID().slice(0, 8)}` }, user.id);
    const variantId = created.variantId;
    const supplier = await purchasing.createSupplier({ name: `Price supplier ${randomUUID()}` });
    const row = async () => (await catalog.listProducts({ search: name }))[0];
    assert.equal((await row()).lastPurchasePrice, null); // no history: nothing invented
    assert.equal((await row()).avgPurchasePrice, null);
    const buy = (invoiceDate: string, lines: Array<{ quantity: number; unitCost: string }>, post = true, extraCosts = '0') =>
      purchasing.createInvoice({ supplierId: supplier.id, invoiceDate, payment: 'CREDIT', extraCosts,
        lines: lines.map((l) => ({ variantId, ...l })) }, user.id, post);
    await buy('2026-10-01', [{ quantity: 10, unitCost: '100' }]);
    await buy('2026-10-05', [{ quantity: 10, unitCost: '130' }], true, '500'); // shipping is landed cost, not price
    assert.equal((await row()).lastPurchasePrice, '130.0000');
    assert.equal((await row()).avgPurchasePrice, '115.0000');
    await buy('2026-10-20', [{ quantity: 5, unitCost: '999' }], false); // a draft is a plan, not a purchase
    assert.equal((await row()).lastPurchasePrice, '130.0000');
    await buy('2026-09-01', [{ quantity: 10, unitCost: '50' }]); // back-dated: averaged, but not "last"
    assert.equal((await row()).lastPurchasePrice, '130.0000');
    assert.equal((await row()).avgPurchasePrice, '93.3333');
    await buy('2026-10-10', [{ quantity: 2, unitCost: '100' }, { quantity: 3, unitCost: '110' }]);
    const latest = await row();
    assert.equal(latest.lastPurchasePrice, '106.0000');
    assert.equal(latest.lastPurchaseDate, '2026-10-10');
    assert.equal(latest.purchasedUnits, 35);
    const detail = await catalog.getProduct(created.id);
    assert.equal(detail.purchases.length, 5);
    assert.equal(detail.lastPurchasePrice, '106.0000');
    assert.equal((await catalog.listProducts({ search: detail.variants[0].sku }))[0].id, created.id); // search by SKU
  });
  await t.test('sales invoice drafts price exactly, never duplicate, and move nothing', async () => {
    const sales = new SalesService(db, ledger);
    const a = await stock(10);
    const b = await stock(5);
    const customer = await sales.createCustomer({ name: `Wholesale ${randomUUID()}` });
    const requestId = randomUUID();
    const body = { requestId, customerId: customer.id, invoiceDate: '2026-10-12', discount: '20',
      lines: [{ variantId: a, quantity: 3, lineTotal: '100' }, { variantId: b, quantity: 2, unitPrice: '45.5' }] };
    const [first, second] = await Promise.all([sales.createDraft(body, user.id), sales.createDraft(body, user.id)]);
    assert.equal(first.id, second.id);
    assert.equal(first.goodsTotal, '191.00'); // 100.00 typed + 2 × 45.50
    assert.equal(first.discount, '20.00');
    assert.equal(first.total, '171.00');
    assert.equal(first.lines.find((l: { variantId: string }) => l.variantId === a).unitPrice, '33.3333');
    assert.equal(await balance(a), 10); // a draft moves no stock
    const [{ n }] = await db.query("SELECT count(*)::int AS n FROM ledger_entry WHERE source_id = $1", [first.id]);
    assert.equal(n, 0); // nor money

    const edited = await sales.updateDraft(first.id, { ...body, discount: '0', lines: [{ variantId: a, quantity: 4, unitPrice: '30' }] });
    assert.equal(edited.total, '120.00');
    assert.equal(edited.lines.length, 1);
    await assert.rejects(sales.updateDraft(first.id, { ...body, discount: '500' }), /cannot exceed/);

    await assert.rejects(sales.updateCustomer(customer.id, { active: false }), refusedWith('customer.archiveDrafts'));
    await assert.rejects(sales.deleteCustomer(customer.id), refusedWith('customer.hasInvoices'));
    await sales.deleteDraft(first.id);
    await sales.updateCustomer(customer.id, { active: false });
    assert.ok((await sales.listCustomers(true)).some((c) => c.id === customer.id));
    await sales.deleteCustomer(customer.id);
  });
  await t.test('a product on a sales invoice is refused deletion with a reason, not a database error', async () => {
    const sales = new SalesService(db, ledger);
    const catalog = new CatalogService(db, finance);
    const created = await catalog.createProduct({ name: `On a sale ${randomUUID()}` }, user.id);
    const customer = await sales.createCustomer({ name: `Buyer ${randomUUID()}` });
    const draft = await sales.createDraft({ customerId: customer.id, invoiceDate: '2026-10-14',
      lines: [{ variantId: created.variantId, quantity: 1, unitPrice: '10' }] }, user.id);
    assert.equal((await catalog.getProduct(created.id)).deletable, false);
    await assert.rejects(catalog.deleteProduct(created.id, user.id), refusedWith('product.usedInSales'));
    await sales.deleteDraft(draft.id);
    await catalog.deleteProduct(created.id, user.id);
  });
  await t.test('profit and loss adds up: sales less cost of goods less expenses, per period and per month', async () => {
    const sales = new SalesService(db, ledger);
    const expenses = new ExpensesService(db, ledger);
    const performance = new PerformanceService(db);
    const day = '2031-05-10'; // a day nothing else in the suite touches
    const before = await performance.report(day, day, 'month');
    const variant = await stock(4);
    const customer = await sales.createCustomer({ name: `P&L ${randomUUID()}` });
    const draft = await sales.createDraft({ customerId: customer.id, invoiceDate: day, lines: [{ variantId: variant, quantity: 3, unitPrice: '50' }] }, user.id);
    await sales.postInvoice(draft.id, '0', user.id);
    await expenses.create({ category: 'P&L test', amount: '30.00', spentOn: day, requestId: randomUUID() }, user.id);

    const after = await performance.report(day, day, 'month');
    const delta = (k: 'revenue' | 'cogs' | 'expenses' | 'netProfit') => Number(after[k]) - Number(before[k]);
    assert.deepEqual([delta('revenue'), delta('cogs'), delta('expenses'), delta('netProfit')], [150, 30, 30, 90]); // 3 × 50, 3 × 10 cost
    const wholesale = after.channels.find((c) => c.key === 'wholesale')!;
    assert.equal(wholesale.cogsBasis, 'actual');
    assert.equal(after.series.length, 1);
    assert.equal(after.series[0].period, '2031-05-01');
    assert.equal(Number(after.series[0].netProfit) - Number(before.series[0].netProfit), 90, 'the month agrees with the period');
  });
  await t.test('posting a sales invoice moves stock and books revenue once; void undoes it exactly', async () => {
    const sales = new SalesService(db, ledger);
    const a = await stock(5);
    const customer = await sales.createCustomer({ name: `Credit ${randomUUID()}` });
    const owed = async () => (await sales.customerDetail(customer.id)).balance;
    const entries = async (id: string) => db.query(
      `SELECT debit_code AS debit, credit_code AS credit, amount, kind, reverses_id AS "reversesId"
       FROM ledger_entry WHERE source_id = $1 ORDER BY created_at`, [id]);
    const draft = (quantity: number) => sales.createDraft({ customerId: customer.id, invoiceDate: '2026-10-13', discount: '10',
      lines: [{ variantId: a, quantity, unitPrice: '50' }] }, user.id);

    const tooMany = await draft(6);
    await assert.rejects(sales.postInvoice(tooMany.id, '0', user.id), refusedWith('sales.stockShort', (b) => {
      assert.equal(reasonOf(b, 'sales.stockShort')!.params!.onHand, 5);
    }));
    assert.equal(await balance(a), 5);
    await sales.deleteDraft(tooMany.id);

    const inv = await draft(3); // 150 - 10 = 140
    await assert.rejects(sales.postInvoice(inv.id, '140.01', user.id), /cannot exceed/);
    const results = await Promise.allSettled([sales.postInvoice(inv.id, '40', user.id), sales.postInvoice(inv.id, '40', user.id)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1); // a double click posts once
    const posted = await sales.getInvoice(inv.id);
    assert.equal(posted.status, 'POSTED');
    assert.match(posted.invoiceNumber!, /^SI-\d+$/);
    assert.equal(posted.paidAmount, '40.00');
    assert.equal(posted.lines[0].unitCost, '10.0000'); // cost frozen on the line
    assert.equal(await balance(a), 2);
    assert.equal(await owed(), '100.00');
    const listed = (await sales.listCustomers()).find((c) => c.id === customer.id)!;
    assert.deepEqual([listed.balance, listed.sold, listed.invoiceCount, listed.lastInvoiceAt], ['100.00', '140.00', 1, '2026-10-13']);
    assert.deepEqual((await entries(inv.id)).map((e: { debit: string; credit: string; amount: string }) => `${e.debit}>${e.credit} ${e.amount}`),
      ['CUSTOMER_RECEIVABLE>SALES 140.00', 'CASH>CUSTOMER_RECEIVABLE 40.00']);
    await assert.rejects(sales.updateDraft(inv.id, { customerId: customer.id, invoiceDate: '2026-10-13', lines: [{ variantId: a, quantity: 1, unitPrice: '1' }] }), /cannot be edited/);
    await assert.rejects(sales.deleteDraft(inv.id), /cannot be deleted/);

    await assert.rejects(sales.recordPayment(inv.id, '100.01', undefined, user.id), /cannot exceed/);
    const paid = await sales.recordPayment(inv.id, '100', 'cash at the shop', user.id);
    assert.equal(paid.paidAmount, '140.00');
    assert.equal(await owed(), '0.00');
    await assert.rejects(sales.voidInvoice(inv.id, 'wrong customer', user.id), refusedWith('sales.voidPaid', (b) => {
      assert.equal(reasonOf(b, 'sales.voidPaid')!.blockers!.length, 2); // both payments, each to reverse
    }));
    for (const p of paid.payments) await sales.reversePayment(inv.id, p.id, user.id);
    await assert.rejects(sales.reversePayment(inv.id, paid.payments[0].id, user.id), /already reversed/);

    const voided = await sales.voidInvoice(inv.id, 'wrong customer', user.id);
    assert.equal(voided.status, 'VOID');
    assert.equal(voided.voidReason, 'wrong customer');
    assert.equal(voided.paidAmount, '0.00');
    assert.equal(await balance(a), 5); // every unit back
    assert.equal(await owed(), '0.00');
    const net = await db.query(
      `SELECT code, COALESCE(SUM(CASE WHEN debit_code = code THEN amount ELSE -amount END), 0)::numeric(14,2) AS net
       FROM ledger_entry, unnest(ARRAY[debit_code, credit_code]) AS code WHERE source_id = $1 GROUP BY code ORDER BY code`, [inv.id]);
    assert.ok(net.every((r: { net: string }) => r.net === '0.00'), JSON.stringify(net)); // cash, receivable and sales all net to zero
    await assert.rejects(sales.voidInvoice(inv.id, 'again', user.id), /only a posted invoice/);
    await assert.rejects(sales.recordPayment(inv.id, '1', undefined, user.id), /only a posted invoice/);
  });

  await t.test('a migration edited after it ran is caught by name', async () => {
    const first = await checkMigrations(db);
    assert.deepEqual(first, { edited: [], pending: [] });
    const [{ name }] = await db.query('SELECT name FROM migration_fingerprint ORDER BY name LIMIT 1');
    const [{ fingerprint }] = await db.query('SELECT fingerprint FROM migration_fingerprint WHERE name = $1', [name]);
    await db.query("UPDATE migration_fingerprint SET fingerprint = 'from an earlier text' WHERE name = $1", [name]);
    assert.deepEqual((await checkMigrations(db)).edited, [name]);
    await db.query('UPDATE migration_fingerprint SET fingerprint = $2 WHERE name = $1', [name, fingerprint]);
    assert.deepEqual((await checkMigrations(db)).edited, []);
  });
  await t.test('a blocked action names every blocker at once, and the screen says it before the click', async () => {
    const catalog = new CatalogService(db, finance);
    const product = await catalog.createProduct({ name: `Busy ${randomUUID()}`, openingStock: 3, unitCost: '10' }, user.id);
    await orders.create(actor, input(product.variantId));
    const supplier = await purchasing.createSupplier({ name: `Busy supplier ${randomUUID()}` });
    await purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: '2026-10-14', payment: 'CREDIT',
      lines: [{ variantId: product.variantId, quantity: 1, unitCost: '10' }] }, user.id);
    const expected = ['product.archiveStock', 'product.archiveOrders', 'product.archiveDrafts'];
    const onScreen = (await catalog.getProduct(product.id)).blocked.archive.map((r: { code: string }) => r.code);
    assert.deepEqual(onScreen, expected);
    await assert.rejects(catalog.archiveProduct(product.id), (error: unknown) => {
      const body = (error as { getResponse: () => Refusal }).getResponse();
      assert.equal(body.code, 'product.archiveBlocked');
      assert.deepEqual(body.reasons!.map((r) => r.code), expected); // all three, not the first
      assert.equal(reasonOf(body, 'product.archiveStock')!.params!.count, 2); // 3 counted − 1 ordered
      assert.match(reasonOf(body, 'product.archiveOrders')!.blockers![0].label!, /^PM-\d+$/);
      return true;
    });
  });

  // ── Corrections: nothing posted is edited or deleted; it is cancelled and re-entered ──
  const entriesOf = (sourceType: string, sourceId: string) => db.query(
    'SELECT id, debit_code AS debit, credit_code AS credit, amount, reverses_id AS "reversesId", reason, actor_id AS "actorId" FROM ledger_entry WHERE source_type = $1 AND source_id = $2 ORDER BY created_at',
    [sourceType, sourceId]);
  /** What a set of entries did to one account, net. */
  const netOn = (rows: Array<{ debit: string; credit: string; amount: string }>, code: string) =>
    Math.round(rows.reduce((n, e) => n + (e.debit === code ? Number(e.amount) : e.credit === code ? -Number(e.amount) : 0), 0) * 100) / 100;

  await t.test('an expense is corrected by voiding it and booking the right one, once', async () => {
    const expenses = new ExpensesService(db, ledger);
    const wrong = await expenses.create({ requestId: randomUUID(), category: 'rent', amount: '15000', spentOn: '2026-10-14' }, user.id);
    const correction = { requestId: randomUUID(), category: 'rent', amount: '1500', spentOn: '2026-10-14', reason: 'typed an extra zero' };
    await assert.rejects(expenses.create(correction, user.id, { id: wrong.id, reason: ' ' }), /correction reason/);
    // A double click and a resend: one void, one replacement.
    const [first, second] = await Promise.all([
      expenses.create(correction, user.id, { id: wrong.id, reason: correction.reason }),
      expenses.create(correction, user.id, { id: wrong.id, reason: correction.reason }),
    ]);
    assert.equal(first.id, second.id);
    assert.equal(first.replacesId, wrong.id);
    const old = (await db.query('SELECT voided_at, voided_by_id AS "by", void_reason AS reason FROM expense WHERE id = $1', [wrong.id]))[0];
    assert.ok(old.voided_at);
    assert.equal(old.by, user.id);
    assert.equal(old.reason, 'typed an extra zero');
    const cash = [...await entriesOf('expense', wrong.id), ...await entriesOf('expense', first.id)];
    assert.equal(cash.length, 3); // the wrong one, its reversal (with the reason), the right one
    assert.equal(cash.find((e: { reversesId: string | null }) => e.reversesId)!.reason, 'typed an extra zero');
    assert.equal(netOn(cash, 'CASH'), -1500);
    // Correcting what is already voided would book a second replacement.
    await assert.rejects(expenses.create({ ...correction, requestId: randomUUID() }, user.id, { id: wrong.id, reason: 'again' }), /already cancelled/);
    // Lists show live expenses unless asked for the cancelled ones too.
    const live = await expenses.list({ search: 'rent' });
    assert.ok(!live.expenses.some((e: { id: string }) => e.id === wrong.id));
    assert.ok((await expenses.list({ search: 'rent', cancelled: true })).expenses.some((e: { id: string; voidedBy: string }) => e.id === wrong.id && e.voidedBy === user.name));
  });

  await t.test('a cash voucher is cancelled or corrected through a reversal, never edited', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const shipping = async () => {
      const flow = await ledger.flow('CASH', day, day, 'day');
      const of = (direction: string) => Number(flow.sources.find((x) => x.code === 'SHIPPING' && x.direction === direction)?.amount ?? 0);
      return { in: of('in'), out: of('out') };
    };
    const before = await shipping();
    const wrong = await finance.recordVoucher({ direction: 'OUT', counter: 'SHIPPING', amount: '15000.00', userId: user.id });
    const fix = { direction: 'OUT' as const, counter: 'SHIPPING' as const, amount: '1500.00', reason: 'extra zero', userId: user.id };
    const [a, b] = await Promise.all([finance.correctVoucher(wrong.id, fix), finance.correctVoucher(wrong.id, fix)]);
    assert.equal(a.id, b.id); // one replacement, however many times it is sent
    assert.equal(a.replacesId, wrong.id);
    const rows = await db.query(
      'SELECT debit_code AS debit, credit_code AS credit, amount, reverses_id AS "reversesId", reason FROM ledger_entry WHERE id = $1 OR reverses_id = $1 OR replaces_id = $1',
      [wrong.id]);
    assert.equal(rows.length, 3);
    assert.equal(netOn(rows, 'CASH'), -1500);
    // Money in and out shows the corrected 1,500 — not 15,000 out and 15,000 back in.
    const after = await shipping();
    assert.deepEqual([after.out - before.out, after.in - before.in], [1500, 0]);
    // The correction can itself be cancelled; cancelling twice changes nothing.
    const [c1, c2] = await Promise.all([finance.cancelVoucher(a.id, 'not paid after all', user.id), finance.cancelVoucher(a.id, 'not paid after all', user.id)]);
    assert.equal(c1.id, c2.id);
    await assert.rejects(finance.correctVoucher(a.id, fix), /already cancelled/);
    await assert.rejects(finance.cancelVoucher(c1.id, 'a reversal is not a voucher', user.id), /voucher not found/);
    await assert.rejects(finance.cancelVoucher(wrong.id, '', user.id), /why it is cancelled/);
    // Only vouchers are cancelled here: an expense's entry is corrected from the expense.
    const expense = await new ExpensesService(db, ledger).create({ requestId: randomUUID(), category: 'fuel', amount: '10', spentOn: '2026-10-14' }, user.id);
    await assert.rejects(finance.cancelVoucher(expense.ledgerEntryId, 'nope', user.id), /voucher not found/);
    // Hidden from the treasury by default, with the running balance still continuous.
    const shown = await ledger.accountLedger('CASH', 500);
    const hidden = await ledger.accountLedger('CASH', 500, undefined, false);
    assert.ok(shown.some((m: { id: string }) => m.id === wrong.id));
    assert.ok(!hidden.some((m: { id: string }) => m.id === wrong.id || m.id === a.id));
    assert.equal(hidden[0].runningBalance, shown[0].runningBalance);
    const cancelledRow = shown.find((m: { id: string }) => m.id === a.id);
    assert.equal(cancelledRow.cancelledBy, user.name);
    assert.equal(cancelledRow.cancelReason, 'not paid after all');
  });

  await t.test('a supplier payment is reversed exactly: its invoices are owed again, once', async () => {
    const supplier = await purchasing.createSupplier({ name: `Reversal ${randomUUID()}` });
    const id = await stock(0);
    const buy = (date: string, total: string) => purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: date, payment: 'CREDIT',
      lines: [{ variantId: id, quantity: 1, unitCost: total }] }, user.id, true);
    const older = await buy('2026-10-01', '100');
    const newer = await buy('2026-10-02', '50');
    const owed = async () => (await purchasing.supplierDetail(supplier.id)).balance;
    const settled = async (invoiceId: string) => (await purchasing.getInvoice(invoiceId)).settledAmount;
    const payment = await purchasing.recordSupplierPayment(supplier.id, '120', undefined, user.id);
    assert.equal(await owed(), '30.00');
    await assert.rejects(purchasing.reverseSupplierPayment(supplier.id, payment.id, '', user.id), /why this payment/);
    const [r1, r2] = await Promise.all([
      purchasing.reverseSupplierPayment(supplier.id, payment.id, 'paid the wrong supplier', user.id),
      purchasing.reverseSupplierPayment(supplier.id, payment.id, 'retry', user.id),
    ]);
    assert.equal(r1.id, r2.id);
    assert.equal(await owed(), '150.00');
    assert.equal(await settled(older.id), '0.00');
    assert.equal(await settled(newer.id), '0.00');
    // Live payments only by default; the reversed one comes back on request.
    assert.equal((await purchasing.supplierDetail(supplier.id)).payments.length, 0);
    assert.equal((await purchasing.supplierDetail(supplier.id, true)).payments.length, 2);

    // A payment from before allocations were kept: the invoice it named first, then the newest.
    const legacy = await purchasing.recordSupplierPayment(supplier.id, '40', undefined, user.id, older.id);
    await db.query('DELETE FROM supplier_payment_allocation WHERE ledger_entry_id = $1', [legacy.id]);
    await purchasing.reverseSupplierPayment(supplier.id, legacy.id, 'legacy', user.id);
    assert.equal(await settled(older.id), '0.00');
    assert.equal(await owed(), '150.00');
  });

  await t.test('a posted purchase invoice is cancelled only when that undoes it exactly', async () => {
    const supplier = await purchasing.createSupplier({ name: `Cancel ${randomUUID()}` });
    const id = await stock(0);
    const buy = (quantity: number, unitCost: string, payment: 'CASH' | 'CREDIT' = 'CREDIT') => purchasing.createInvoice({
      supplierId: supplier.id, invoiceDate: '2026-10-14', payment, lines: [{ variantId: id, quantity, unitCost }] }, user.id, true);
    const cost = async () => (await db.query('SELECT unit_cost AS c FROM product_variant WHERE id = $1', [id]))[0].c;
    await buy(10, '100'); // 10 @ 100
    const mistake = await buy(10, '130'); // average now 115
    assert.equal(await cost(), '115.0000');

    // Paid on: its payment is reversed first.
    const paid = await purchasing.recordSupplierPayment(supplier.id, '100', undefined, user.id, mistake.id);
    await assert.rejects(purchasing.voidInvoice(mistake.id, 'wrong price', user.id), refusedWith('invoice.cancelPaid', (b) => {
      assert.equal(reasonOf(b, 'invoice.cancelPaid')!.blockers![0].kind, 'supplier_payment');
    }));
    // The screen says the same thing before anyone clicks.
    assert.deepEqual((await purchasing.getInvoice(mistake.id)).blocked.cancel.map((r: { code: string }) => r.code), ['invoice.cancelPaid']);
    await purchasing.reverseSupplierPayment(supplier.id, paid.id, 'to cancel the invoice', user.id);

    // Cancelled twice at once, with a correction draft: one cancellation, one draft.
    const [a, b] = await Promise.all([
      purchasing.voidInvoice(mistake.id, 'wrong price', user.id, true),
      purchasing.voidInvoice(mistake.id, 'wrong price', user.id, true),
    ]);
    assert.equal(a.draftId, b.draftId);
    assert.equal(await balance(id), 10); // its 10 left again
    assert.equal(await cost(), '100.0000'); // and the average is what it was before it
    const voided = await purchasing.getInvoice(mistake.id);
    assert.equal(voided.status, 'VOID');
    assert.equal(voided.voidedBy, user.name);
    assert.equal(voided.replacedById, a.draftId);
    const books = await entriesOf('purchase_invoice', mistake.id);
    assert.equal(netOn(books, 'INVENTORY'), 0);
    assert.equal(netOn(books, 'SUPPLIER_PAYABLE'), 0);
    const draft = await purchasing.getInvoice(a.draftId!);
    assert.equal(draft.status, 'DRAFT');
    assert.equal(draft.replacesId, mistake.id);
    assert.equal(draft.lines.length, 1);
    assert.ok(!(await purchasing.listInvoices()).some((i: { id: string }) => i.id === mistake.id));
    assert.ok((await purchasing.listInvoices(true)).some((i: { id: string }) => i.id === mistake.id));

    // Goods that moved since were costed with it in the average: refused, naming the product.
    const sold = await buy(5, '200');
    await orders.create(actor, input(id));
    await assert.rejects(purchasing.voidInvoice(sold.id, 'late', user.id), refusedWith('invoice.cancelMoved', (b) => {
      const kinds = reasonOf(b, 'invoice.cancelMoved')!.blockers!.map((x) => x.kind);
      assert.ok(kinds.includes('product') && kinds.includes('order')); // what moved, and the order that moved it
    }));
    assert.equal((await purchasing.getInvoice(sold.id)).status, 'POSTED');

    // A cash invoice's cash comes back with it.
    const cashId = await stock(0);
    const cashBuy = await purchasing.createInvoice({ supplierId: supplier.id, invoiceDate: '2026-10-14', payment: 'CASH',
      lines: [{ variantId: cashId, quantity: 2, unitCost: '30' }] }, user.id, true);
    await purchasing.voidInvoice(cashBuy.id, 'never bought', user.id);
    assert.equal(netOn(await entriesOf('purchase_invoice', cashBuy.id), 'CASH'), 0);
    assert.equal(await balance(cashId), 0);
    await assert.rejects(purchasing.voidInvoice(cashBuy.id, '', user.id), /why this invoice/);
  });
});
