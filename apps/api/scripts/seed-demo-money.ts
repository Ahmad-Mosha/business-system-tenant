import 'reflect-metadata';
import type { EntityManager } from 'typeorm';
import dataSource from '../src/database/data-source';
import { User } from '../src/auth/user.entity';
import { Product } from '../src/catalog/product.entity';
import { ProductVariant } from '../src/catalog/product-variant.entity';
import { StockMovement } from '../src/inventory/stock-movement.entity';
import { Order } from '../src/orders/order.entity';
import { OrderItem } from '../src/orders/order-item.entity';
import { LedgerEntry, type LedgerEntryKind } from '../src/finance/ledger-entry.entity';
import type { LedgerAccountCode } from '../src/finance/ledger-account.entity';

/**
 * One-off local demo for the 2026-09-16 owners meeting: builds a small,
 * clearly-labelled ([DEMO]) scenario showing how a purchase, a sale, its
 * cost, a channel fee and shipping connect into revenue and profit.
 *
 * Local dev DB only — never point this at Neon. Safe to re-run: skips if
 * the demo product already exists.
 *
 * This mirrors what catalog.service.ts / orders.service.ts / finance.service.ts
 * actually do (same tables, same entry shapes) rather than inventing a
 * parallel format — it just posts the writes directly instead of going
 * through NestJS DI, which pulls in unrelated services this script doesn't
 * need. The one thing that ISN'T a real code path today: orders.service.ts
 * never posts a COGS ledger entry on a sale (see the 2026-09-15 numbers
 * audit — this is the central gap). That entry below is marked
 * sourceType 'demo' specifically because it's simulating a piece that
 * doesn't exist yet, not because anything else here is fake.
 */
const PRODUCT_NAME = '[DEMO] تيشيرت قطن تجريبي';
const UNIT_COST = '100.00';
const SELLING_PRICE = '180.00';

function post(
  em: EntityManager,
  entry: {
    amount: string;
    debit: LedgerAccountCode;
    credit: LedgerAccountCode;
    kind: LedgerEntryKind;
    memo: string;
    sourceType: string;
    sourceId: string;
  },
) {
  return em.insert(LedgerEntry, {
    amount: entry.amount,
    debitCode: entry.debit,
    creditCode: entry.credit,
    kind: entry.kind,
    memo: entry.memo,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
  });
}

async function main() {
  await dataSource.initialize();
  try {
    const already = await dataSource.getRepository(Product).findOne({ where: { name: PRODUCT_NAME } });
    if (already) {
      console.log(`Already seeded — "${PRODUCT_NAME}" exists (${already.id}). Nothing to do.`);
      return;
    }

    const admin = await dataSource.getRepository(User).findOne({ where: { role: 'ADMIN' } });
    if (!admin) throw new Error('No admin user in this DB — boot the app once first so one gets seeded.');

    await dataSource.transaction(async (em) => {
      const product = await em.save(Product, {
        name: PRODUCT_NAME,
        category: 'COSMETICS',
        discovered: false,
        active: true,
      });
      const variant = await em.save(ProductVariant, {
        productId: product.id,
        name: 'Default',
        attributes: {},
        unitCost: UNIT_COST,
        sellingPrice: SELLING_PRICE,
        active: true,
      });
      console.log(`Product created: ${product.id} / variant ${variant.id}`);

      // A real purchase — 50 units in, cash converts to inventory.
      await em.insert(StockMovement, {
        variantId: variant.id,
        quantity: 50,
        reason: 'PURCHASE',
        unitCost: UNIT_COST,
        note: '[DEMO] فاتورة شراء تجريبية',
        createdById: admin.id,
      });
      await post(em, {
        amount: (50 * Number(UNIT_COST)).toFixed(2),
        debit: 'INVENTORY',
        credit: 'CASH',
        kind: 'PURCHASE',
        memo: '[DEMO] فاتورة شراء تجريبية',
        sourceType: 'demo',
        sourceId: variant.id,
      });
      console.log('Purchase posted: 50 units @ 100.00 EGP (debit INVENTORY / credit CASH, 5,000.00)');

      // Order A — 3 units, delivered and paid.
      const itemsA = [{ title: PRODUCT_NAME, quantity: 3, unitPrice: SELLING_PRICE }];
      const subtotalA = (3 * Number(SELLING_PRICE)).toFixed(2);
      const orderA = await em.save(Order, {
        orderNumber: 'DEMO-A',
        source: 'SOCIAL',
        externalId: null,
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        paymentMethod: 'COD',
        customerName: '[DEMO] عميل تجريبي واحد',
        customerPhone: '01012345678',
        governorate: 'القاهرة',
        address: '[DEMO] عنوان تجريبي',
        subtotal: subtotalA,
        shippingCost: '0.00',
        total: subtotalA,
        createdById: admin.id,
        items: itemsA.map((i) =>
          em.create(OrderItem, {
            variantId: variant.id,
            title: i.title,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: (i.quantity * Number(i.unitPrice)).toFixed(2),
          }),
        ),
      });
      await em.insert(StockMovement, {
        variantId: variant.id,
        quantity: -3,
        reason: 'SALE',
        unitCost: UNIT_COST,
        sourceType: 'order',
        sourceId: orderA.id,
      });
      await post(em, {
        amount: subtotalA,
        debit: 'CASH',
        credit: 'SALES',
        kind: 'ORDER_SALE',
        memo: `[DEMO] طلب ${orderA.orderNumber}`,
        sourceType: 'order',
        sourceId: orderA.id,
      });
      const cogsAmount = (3 * Number(UNIT_COST)).toFixed(2);
      await post(em, {
        amount: cogsAmount,
        debit: 'COGS',
        credit: 'INVENTORY',
        kind: 'COGS',
        memo: '[DEMO] simulated — the real order flow does not post this yet',
        sourceType: 'demo',
        sourceId: orderA.id,
      });
      console.log(`Order ${orderA.orderNumber}: 3 units, delivered + paid — revenue ${subtotalA}, simulated COGS ${cogsAmount}`);

      // Order B — 2 units, delivered but unpaid: "delivered ≠ paid".
      const subtotalB = (2 * Number(SELLING_PRICE)).toFixed(2);
      const orderB = await em.save(Order, {
        orderNumber: 'DEMO-B',
        source: 'SOCIAL',
        externalId: null,
        status: 'DELIVERED',
        paymentStatus: 'UNPAID',
        paymentMethod: 'COD',
        customerName: '[DEMO] عميل تجريبي اتنين',
        customerPhone: '01098765432',
        governorate: 'الجيزة',
        address: '[DEMO] عنوان تجريبي تاني',
        subtotal: subtotalB,
        shippingCost: '0.00',
        total: subtotalB,
        createdById: admin.id,
        items: [
          em.create(OrderItem, {
            variantId: variant.id,
            title: PRODUCT_NAME,
            quantity: 2,
            unitPrice: SELLING_PRICE,
            lineTotal: subtotalB,
          }),
        ],
      });
      await em.insert(StockMovement, {
        variantId: variant.id,
        quantity: -2,
        reason: 'SALE',
        unitCost: UNIT_COST,
        sourceType: 'order',
        sourceId: orderB.id,
      });
      console.log(`Order ${orderB.orderNumber}: 2 units, delivered but UNPAID — no SALES entry yet`);

      // A channel fee and a shipping cost, same shape a real voucher posts.
      await post(em, {
        amount: '54.00',
        debit: 'CHANNEL_FEES',
        credit: 'CASH',
        kind: 'PAYMENT_OUT',
        memo: `[DEMO] عمولة قناة تجريبية على طلب ${orderA.orderNumber}`,
        sourceType: 'demo',
        sourceId: orderA.id,
      });
      await post(em, {
        amount: '40.00',
        debit: 'SHIPPING',
        credit: 'CASH',
        kind: 'PAYMENT_OUT',
        memo: '[DEMO] مصاريف شحن تجريبية',
        sourceType: 'demo',
        sourceId: orderA.id,
      });
      console.log('Posted a channel-fee entry (54.00) and a shipping entry (40.00)');
    });

    console.log('\nDone. Everything is tagged [DEMO] in its name/memo — filter or delete by that prefix afterwards.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
