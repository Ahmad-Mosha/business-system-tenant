import type { MigrationInterface, QueryRunner } from 'typeorm';
export class LandedCostPrecision1789552000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE product_variant ALTER COLUMN unit_cost TYPE numeric(16,4)');
    await runner.query('ALTER TABLE stock_movement ALTER COLUMN unit_cost TYPE numeric(16,4)');
    await runner.query('ALTER TABLE purchase_invoice ADD COLUMN extra_costs_paid_separately boolean NOT NULL DEFAULT false');
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE purchase_invoice DROP COLUMN extra_costs_paid_separately');
    await runner.query('ALTER TABLE stock_movement ALTER COLUMN unit_cost TYPE numeric(14,2)');
    await runner.query('ALTER TABLE product_variant ALTER COLUMN unit_cost TYPE numeric(14,2)');
  }
}
