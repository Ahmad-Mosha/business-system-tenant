import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Correcting posted records without editing them (docs/business-rules.md §7):
 * a cancellation keeps why and who, a correction points at what it replaces,
 * and a supplier payment remembers which invoices it settled so it can be
 * reversed exactly. (The stock write order is its own migration, StockMovementSequence.)
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
