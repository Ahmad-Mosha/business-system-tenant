import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LEDGER_ACCOUNTS, LedgerAccount } from './ledger-account.entity';

/**
 * Owns the double-entry ledger the money module is built on. For now it only
 * guarantees the chart of accounts exists; posting and balance queries land
 * here next.
 */
@Injectable()
export class LedgerService {
  private readonly log = new Logger(LedgerService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Ensures the fixed chart of accounts is present. Idempotent: upserts by
   * code, so renaming an account in `LEDGER_ACCOUNTS` and restarting updates
   * the row, and adding one creates it — nothing existing is touched otherwise.
   */
  async seedAccounts(): Promise<void> {
    const rows = LEDGER_ACCOUNTS.map((a, sort) => ({ ...a, sort }));
    await this.db.getRepository(LedgerAccount).upsert(rows, ['code']);
    this.log.log(`ledger: ${rows.length} accounts ready`);
  }
}
