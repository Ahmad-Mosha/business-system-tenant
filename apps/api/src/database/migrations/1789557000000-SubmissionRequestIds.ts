import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A form sends the same request id however many times it is submitted (a
 * double click, a retry after a lost response, a restored draft), so a purchase
 * invoice or a manual order is created at most once. Existing rows keep NULL.
 */
export class SubmissionRequestIds1789557000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query('ALTER TABLE purchase_invoice ADD COLUMN request_id uuid');
    await r.query('ALTER TABLE purchase_invoice ADD CONSTRAINT uq_purchase_invoice_request UNIQUE (request_id)');
    await r.query('ALTER TABLE customer_order ADD COLUMN request_id uuid');
    await r.query('ALTER TABLE customer_order ADD CONSTRAINT uq_order_request UNIQUE (request_id)');
  }

  async down(r: QueryRunner): Promise<void> {
    await r.query('ALTER TABLE customer_order DROP CONSTRAINT uq_order_request');
    await r.query('ALTER TABLE customer_order DROP COLUMN request_id');
    await r.query('ALTER TABLE purchase_invoice DROP CONSTRAINT uq_purchase_invoice_request');
    await r.query('ALTER TABLE purchase_invoice DROP COLUMN request_id');
  }
}
