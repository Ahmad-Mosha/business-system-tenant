import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `stock_movement.seq` — the order stock rows were written in. A timestamp is
 * the writing transaction's start, so a sale that began just before a purchase
 * posted can carry an earlier time yet land after it; the sequence is taken at
 * insert, under the product's row lock, so "did anything move since?" (a
 * purchase invoice's cancellation) is exact.
 *
 * Skips itself where the column already exists: an early build carried it in
 * RecordCorrections, and a database migrated then has it already.
 */
export class StockMovementSequence1789563000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    const [{ present }] = await r.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movement' AND column_name = 'seq') AS present",
    );
    if (present) return;
    await r.query('CREATE SEQUENCE stock_movement_seq');
    await r.query('ALTER TABLE stock_movement ADD COLUMN seq bigint');
    await r.query(`
      UPDATE stock_movement m SET seq = o.n
      FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM stock_movement) o
      WHERE o.id = m.id
    `);
    await r.query("SELECT setval('stock_movement_seq', COALESCE((SELECT max(seq) FROM stock_movement), 0) + 1, false)");
    await r.query(`
      ALTER TABLE stock_movement
        ALTER COLUMN seq SET DEFAULT nextval('stock_movement_seq'),
        ALTER COLUMN seq SET NOT NULL
    `);
    await r.query('ALTER SEQUENCE stock_movement_seq OWNED BY stock_movement.seq');
    await r.query('CREATE INDEX ix_stock_movement_variant_seq ON stock_movement (variant_id, seq)');
  }

  async down(r: QueryRunner): Promise<void> {
    await r.query('DROP INDEX IF EXISTS ix_stock_movement_variant_seq');
    await r.query('ALTER TABLE stock_movement DROP COLUMN IF EXISTS seq');
  }
}
