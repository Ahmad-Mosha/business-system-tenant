import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderProfitSnapshots1789554000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query('ALTER TABLE ledger_entry ADD COLUMN order_shipping_cost numeric(14,2)');
    await r.query(
      'ALTER TABLE ledger_entry ADD CONSTRAINT ck_ledger_order_shipping_nonnegative CHECK (order_shipping_cost >= 0)',
    );
  }

  async down(r: QueryRunner): Promise<void> {
    await r.query('ALTER TABLE ledger_entry DROP CONSTRAINT ck_ledger_order_shipping_nonnegative');
    await r.query('ALTER TABLE ledger_entry DROP COLUMN order_shipping_cost');
  }
}
