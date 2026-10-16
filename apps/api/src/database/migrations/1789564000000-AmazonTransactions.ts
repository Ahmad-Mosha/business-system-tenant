import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Amazon's transaction reports, stored line by line like noon's settlements:
 * one row per upload, one per report line, each line tied to its product's
 * listing when its seller SKU (or, for a fee, its order) names one.
 */
export class AmazonTransactions1789564000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE amazon_import (
        id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        filename text NOT NULL,
        file_hash text NOT NULL CONSTRAINT uq_amazon_import_file_hash UNIQUE,
        rows_in_file integer NOT NULL,
        rows_inserted integer NOT NULL,
        rows_skipped integer NOT NULL,
        rows_updated integer NOT NULL DEFAULT 0,
        unmapped_listings integer NOT NULL DEFAULT 0,
        period_start date,
        period_end date,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`
      CREATE TABLE amazon_transaction (
        id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        fingerprint text NOT NULL CONSTRAINT uq_amazon_transaction_fingerprint UNIQUE,
        import_id uuid NOT NULL REFERENCES amazon_import(id) ON DELETE CASCADE,
        posted_at timestamptz NOT NULL,
        settlement_id text,
        type text NOT NULL,
        order_id text,
        sku text,
        description text NOT NULL,
        quantity integer NOT NULL DEFAULT 0,
        marketplace text,
        fulfillment text,
        product_sales numeric(14,2) NOT NULL,
        shipping_credits numeric(14,2) NOT NULL,
        promotional_rebates numeric(14,2) NOT NULL,
        selling_fees numeric(14,2) NOT NULL,
        fba_fees numeric(14,2) NOT NULL,
        other_transaction_fees numeric(14,2) NOT NULL,
        other numeric(14,2) NOT NULL,
        total numeric(14,2) NOT NULL,
        status text,
        release_at timestamptz,
        listing_id uuid REFERENCES channel_listing(id) ON DELETE SET NULL
      )
    `);
    await r.query('CREATE INDEX ix_amazon_tx_posted ON amazon_transaction (posted_at)');
    await r.query('CREATE INDEX ix_amazon_tx_listing ON amazon_transaction (listing_id)');
    await r.query('CREATE INDEX ix_amazon_tx_order ON amazon_transaction (order_id)');
  }

  async down(r: QueryRunner): Promise<void> {
    await r.query('DROP TABLE amazon_transaction');
    await r.query('DROP TABLE amazon_import');
  }
}
