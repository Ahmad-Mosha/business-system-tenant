import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DataSource } from 'typeorm';
import { ormOptions } from './orm-options';
import { LedgerService } from '../finance/ledger.service';
import { FinanceService } from '../finance/finance.service';
import { OrdersService } from '../orders/orders.service';
import { PurchasingService } from '../purchasing/purchasing.service';
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
  await t.test('a ledger entry can only be reversed once', async () => {
    const entry = await ledger.post({ amount: '10', debit: 'CASH', credit: 'OWNER_CAPITAL', kind: 'CASH_DEPOSIT' });
    const [a, b] = await Promise.all([ledger.reverse(entry.id), ledger.reverse(entry.id)]);
    assert.equal(a.id, b.id);
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
