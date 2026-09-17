import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderNumberIntegrity1789555000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM customer_order GROUP BY order_number HAVING count(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot enforce unique order numbers: duplicate order_number values exist';
        END IF;
      END $$
    `);
    // Keep the existing lookup index during rollout. The new unique index is
    // additive, so a failed migration never removes a working database object.
    await r.query('CREATE UNIQUE INDEX "uq_order_number" ON "customer_order" ("order_number")');

    await r.query('CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1000');
    await r.query(`
      DO $$
      DECLARE
        max_used bigint;
        sequence_last bigint;
        sequence_called boolean;
        target bigint;
      BEGIN
        SELECT COALESCE(MAX(substring(order_number FROM '^PM-([0-9]+)$')::bigint), 999)
          INTO max_used
          FROM customer_order
          WHERE order_number ~ '^PM-[0-9]+$';
        SELECT last_value, is_called
          INTO sequence_last, sequence_called
          FROM order_number_seq;

        target := GREATEST(
          max_used,
          CASE WHEN sequence_called THEN sequence_last ELSE sequence_last - 1 END
        );
        IF target < 1000 THEN
          PERFORM setval('order_number_seq', 1000, false);
        ELSE
          PERFORM setval('order_number_seq', target, true);
        END IF;
      END $$
    `);
  }

  async down(r: QueryRunner): Promise<void> {
    await r.query('DROP INDEX "public"."uq_order_number"');
    // Keep the sequence and its current value. Older application versions use
    // it too, and dropping it during a rollback could immediately reuse IDs.
  }
}
