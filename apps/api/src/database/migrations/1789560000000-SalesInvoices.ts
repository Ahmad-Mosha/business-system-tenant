import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Customers and sales invoices. Drafts only touch these tables; nothing here posts stock or money. */
export class SalesInvoices1789560000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query(`CREATE TABLE customer (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name text NOT NULL, phone text, note text,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await r.query(`CREATE TABLE sales_invoice (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      request_id uuid, invoice_number text,
      customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
      invoice_date date NOT NULL,
      status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'VOID')),
      goods_total numeric(14,2) NOT NULL DEFAULT 0, discount numeric(14,2) NOT NULL DEFAULT 0,
      total numeric(14,2) NOT NULL DEFAULT 0, paid_amount numeric(14,2) NOT NULL DEFAULT 0,
      notes text, posted_at timestamptz, created_by_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_sales_invoice_request UNIQUE (request_id),
      CONSTRAINT uq_sales_invoice_number UNIQUE (invoice_number),
      CONSTRAINT ck_sales_invoice_totals CHECK (
        goods_total >= 0 AND discount >= 0 AND discount <= goods_total
        AND total = goods_total - discount AND paid_amount >= 0 AND paid_amount <= total))`);
    await r.query('CREATE INDEX ix_sales_invoice_customer ON sales_invoice (customer_id)');
    await r.query('CREATE INDEX ix_sales_invoice_status ON sales_invoice (status)');
    await r.query(`CREATE TABLE sales_invoice_line (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id uuid NOT NULL REFERENCES sales_invoice(id) ON DELETE CASCADE,
      variant_id uuid NOT NULL REFERENCES product_variant(id) ON DELETE RESTRICT,
      quantity int NOT NULL CHECK (quantity > 0),
      unit_price numeric(14,4) NOT NULL CHECK (unit_price >= 0),
      line_total numeric(14,2) NOT NULL CHECK (line_total >= 0),
      unit_cost numeric(16,4))`);
    await r.query('CREATE INDEX ix_sales_line_invoice ON sales_invoice_line (invoice_id)');
    await r.query('CREATE INDEX ix_sales_line_variant ON sales_invoice_line (variant_id)');
    await r.query('CREATE SEQUENCE sales_invoice_number_seq START 1001');
  }

  async down(r: QueryRunner): Promise<void> {
    await r.query('DROP SEQUENCE sales_invoice_number_seq');
    await r.query('DROP TABLE sales_invoice_line');
    await r.query('DROP TABLE sales_invoice');
    await r.query('DROP TABLE customer');
  }
}
