import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Purchase history is now read per product (last and average purchase price). */
export class PurchaseLineVariantIndex1789559000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query('CREATE INDEX ix_purchase_line_variant ON purchase_invoice_line (variant_id)');
  }

  async down(r: QueryRunner): Promise<void> {
    await r.query('DROP INDEX ix_purchase_line_variant');
  }
}
