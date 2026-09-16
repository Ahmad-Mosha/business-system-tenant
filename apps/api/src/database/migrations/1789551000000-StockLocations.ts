import type { MigrationInterface, QueryRunner } from 'typeorm';

export class StockLocations1789551000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // Preserve the existing pool as our warehouse. Historical noon quantities
    // cannot be inferred; owners reconcile them using explicit transfers.
    await runner.query("ALTER TABLE stock_movement ADD COLUMN location text NOT NULL DEFAULT 'WAREHOUSE'");
    await runner.query("ALTER TABLE stock_movement ADD CONSTRAINT ck_stock_location CHECK (location IN ('WAREHOUSE', 'NOON'))");
    await runner.query('CREATE INDEX ix_stock_location ON stock_movement (variant_id, location, occurred_at)');
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP INDEX ix_stock_location');
    await runner.query('ALTER TABLE stock_movement DROP COLUMN location');
  }
}
