import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Correcting posted records without editing them (docs/business-rules.md §7):
 * a cancellation keeps why and who, a correction points at what it replaces,
 * and a supplier payment remembers which invoices it settled so it can be
 * reversed exactly.
 *
 * `stock_movement.seq` is the order rows were written in. A timestamp is the
 * writing transaction's start, so a sale that began just before a purchase
 * posted can carry an earlier time yet land after it; the sequence is taken at
 * insert, under the product's row lock, so "did anything move since?" is exact.
 */
export class RecordCorrections1789562000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query(`
      ALTER TABLE ledger_entry
        ADD COLUMN reason text,
        ADD COLUMN replaces_id uuid REFERENCES ledger_entry(id)
    `);
    // "Was this entry reversed?" is asked of every row the treasury shows.
    await r.query('CREATE INDEX ix_ledger_entry_reverses ON ledger_entry (reverses_id) WHERE reverses_id IS NOT NULL');
    await r.query('CREATE INDEX ix_ledger_entry_replaces ON ledger_entry (replaces_id) WHERE replaces_id IS NOT NULL');

    await r.query(`
      ALTER TABLE expense
        ADD COLUMN voided_by_id uuid,
        ADD COLUMN replaces_id uuid REFERENCES expense(id)
    `);
    await r.query(`
      ALTER TABLE purchase_invoice
        ADD COLUMN void_reason text,
        ADD COLUMN voided_at timestamptz,
        ADD COLUMN voided_by_id uuid,
        ADD COLUMN replaces_id uuid REFERENCES purchase_invoice(id) ON DELETE SET NULL
    `);
    await r.query('ALTER TABLE sales_invoice ADD COLUMN voided_by_id uuid');

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

    await r.query(`
      CREATE TABLE supplier_payment_allocation (
        ledger_entry_id uuid NOT NULL REFERENCES ledger_entry(id),
        invoice_id uuid NOT NULL REFERENCES purchase_invoice(id),
        amount numeric(14,2) NOT NULL CHECK (amount > 0),
        PRIMARY KEY (ledger_entry_id, invoice_id)
      )
    `);
  }

  async down(r: QueryRunner): Promise<void> {
    await r.query('DROP TABLE supplier_payment_allocation');
    await r.query('DROP INDEX ix_stock_movement_variant_seq');
    await r.query('ALTER TABLE stock_movement DROP COLUMN seq');
    await r.query('ALTER TABLE sales_invoice DROP COLUMN voided_by_id');
    await r.query(`
      ALTER TABLE purchase_invoice
        DROP COLUMN replaces_id, DROP COLUMN voided_by_id, DROP COLUMN voided_at, DROP COLUMN void_reason
    `);
    await r.query('ALTER TABLE expense DROP COLUMN replaces_id, DROP COLUMN voided_by_id');
    await r.query('DROP INDEX ix_ledger_entry_replaces');
    await r.query('DROP INDEX ix_ledger_entry_reverses');
    await r.query('ALTER TABLE ledger_entry DROP COLUMN replaces_id, DROP COLUMN reason');
  }
}
