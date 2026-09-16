import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderReturns1789550000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE customer_order ADD COLUMN return_reason text, ADD COLUMN return_restock boolean');
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE customer_order DROP COLUMN return_restock, DROP COLUMN return_reason');
  }
}
