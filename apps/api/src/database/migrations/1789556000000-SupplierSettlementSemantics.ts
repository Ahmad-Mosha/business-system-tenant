import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierSettlementSemantics1789556000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // Older rows included third-party landed costs in settled_amount. Preserve
    // every real supplier payment while removing only that deterministic offset.
    await runner.query(`
      UPDATE purchase_invoice
      SET settled_amount = GREATEST(settled_amount - extra_costs, 0)
      WHERE extra_costs_paid_separately
    `);
    await runner.query(`
      ALTER TABLE purchase_invoice
      ADD CONSTRAINT ck_purchase_invoice_totals
        CHECK (
          goods_total >= 0
          AND extra_costs >= 0
          AND landed_total = goods_total + extra_costs
        ),
      ADD CONSTRAINT ck_purchase_invoice_settlement
        CHECK (
          settled_amount >= 0
          AND settled_amount <= CASE
            WHEN extra_costs_paid_separately THEN goods_total
            ELSE landed_total
          END
        )
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE purchase_invoice
      DROP CONSTRAINT ck_purchase_invoice_settlement,
      DROP CONSTRAINT ck_purchase_invoice_totals
    `);
    await runner.query(`
      UPDATE purchase_invoice
      SET settled_amount = LEAST(landed_total, settled_amount + extra_costs)
      WHERE extra_costs_paid_separately
    `);
  }
}
