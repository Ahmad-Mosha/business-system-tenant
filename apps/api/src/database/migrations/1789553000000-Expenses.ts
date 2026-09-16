import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Expenses1789553000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query(`CREATE TABLE expense_category (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL,
      key text NOT NULL, CONSTRAINT uq_expense_category_key UNIQUE (key))`);
    await r.query(`CREATE TABLE expense (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), request_id uuid NOT NULL,
      category_id uuid NOT NULL REFERENCES expense_category(id) ON DELETE RESTRICT,
      amount numeric(14,2) NOT NULL CHECK (amount > 0), spent_on date NOT NULL, note text,
      ledger_entry_id uuid NOT NULL REFERENCES ledger_entry(id) ON DELETE RESTRICT,
      created_by_id uuid NOT NULL, voided_at timestamptz, void_reason text, created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_expense_request UNIQUE (request_id))`);
    await r.query('CREATE INDEX ix_expense_date ON expense (spent_on, created_at)');
  }
  async down(r: QueryRunner): Promise<void> {
    await r.query('DROP TABLE expense');
    await r.query('DROP TABLE expense_category');
  }
}
