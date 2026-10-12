import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A line can be typed as quantity + total, which makes the unit cost a
 * division (100 ÷ 3 = 33.3333). Widening from 2 to 4 decimals keeps every
 * existing value exactly; line totals stay at 2 and remain the amount owed.
 */
export class PurchaseLineUnitPrecision1789558000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query('ALTER TABLE purchase_invoice_line ALTER COLUMN unit_cost TYPE numeric(14,4)');
  }

  async down(r: QueryRunner): Promise<void> {
    // Refuses rather than rounds: a value with more than 2 decimals would change.
    await r.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM purchase_invoice_line WHERE unit_cost <> round(unit_cost, 2)) THEN
        RAISE EXCEPTION 'purchase lines have unit costs with more than 2 decimals';
      END IF;
    END $$`);
    await r.query('ALTER TABLE purchase_invoice_line ALTER COLUMN unit_cost TYPE numeric(14,2)');
  }
}
