import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ExpensesService } from '../finance/expenses.service';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DataSource } from 'typeorm';
import { ormOptions } from './orm-options';
import { LedgerService } from '../finance/ledger.service';
import { FinanceService } from '../finance/finance.service';
import { OrdersService } from '../orders/orders.service';
import { PurchasingService } from '../purchasing/purchasing.service';
import { CatalogService } from '../catalog/catalog.service';
import { Product } from '../catalog/product.entity';
import { ProductVariant } from '../catalog/product-variant.entity';
import { StockMovement } from '../inventory/stock-movement.entity';
import { User } from '../auth/user.entity';

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
  await orders.onModuleInit();
  const purchasing = new PurchasingService(db, ledger);
  const user = await db.getRepository(User).save({ email: `test-${Date.now()}@example.invalid`, name: 'Test', passwordHash: 'unused', role: 'ADMIN' });
  const actor = { id: user.id, name: user.name, role: 'ADMIN' as const, email: user.email };
  async function stock(quantity: number) {
    const product = await db.getRepository(Product).save({ name: 'Integrity test' });
    const variant = await db.getRepository(ProductVariant).save({ productId: product.id, unitCost: '10.00' });
    await db.getRepository(StockMovement).save({ variantId: variant.id, quantity, reason: 'COUNT' });
    return variant.id;
  }
  const input = (variantId: string, quantity = 1) => ({ customerName: 'Test', customerPhone: '01012345678', governorate: 'القاهرة', items: [{ variantId, quantity, unitPrice: '20.00' }] });
  const balance = async (id: string) => Number((await db.query('SELECT SUM(quantity) AS n FROM stock_movement WHERE variant_id = $1', [id]))[0].n);

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
  await t.test('concurrent payment and cancellation requests post exactly once', async () => {
    const id = await stock(1);
    const order = await orders.create(actor, input(id));
    await Promise.all([orders.updatePayment(actor, order.id, 'PAID'), orders.updatePayment(actor, order.id, 'PAID')]);
    assert.equal(Number((await db.query("SELECT count(*) AS n FROM ledger_entry WHERE source_id = $1 AND kind = 'ORDER_SALE'", [order.id]))[0].n), 1);
    await assert.rejects(orders.update(actor, order.id, input(id)));
    await Promise.all([orders.updateStatus(actor, order.id, 'CANCELLED'), orders.updateStatus(actor, order.id, 'CANCELLED')]);
    assert.equal(await balance(id), 1);
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
    assert.equal(inv.settledAmount, '1.00');
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
});
