import type { MigrationInterface, QueryRunner } from 'typeorm';

/** A voided sales invoice keeps why and when, beside its reversal. */
export class SalesInvoiceVoids1789561000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query('ALTER TABLE sales_invoice ADD COLUMN void_reason text, ADD COLUMN voided_at timestamptz');
  }

  async down(r: QueryRunner): Promise<void> {
    await r.query('ALTER TABLE sales_invoice DROP COLUMN voided_at, DROP COLUMN void_reason');
  }
}
