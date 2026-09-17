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
import { Order } from '../orders/order.entity';
import { PurchasingService } from '../purchasing/purchasing.service';
import { CatalogService } from '../catalog/catalog.service';
import { Product } from '../catalog/product.entity';
import { ProductVariant } from '../catalog/product-variant.entity';
import { StockMovement } from '../inventory/stock-movement.entity';
import { User } from '../auth/user.entity';
import { EasyOrdersService } from '../integrations/easyorders/easyorders.service';

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
