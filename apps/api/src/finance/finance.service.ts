import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CashAccount } from './cash-account.entity';
import { CashTransaction, type CashReason } from './cash-transaction.entity';

const MONEY = /^\d+(\.\d{1,2})?$/;

@Injectable()
export class FinanceService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private async account(): Promise<CashAccount> {
    const repo = this.db.getRepository(CashAccount);
    return (await repo.findOneBy({ id: 'default' })) ?? repo.create({ id: 'default', openingBalance: '0', openingAsOf: null });
  }

  /**
   * Cash on hand, plus what it's built from — the same "Assets = Cash +
   * Inventory" identity a balance sheet uses, made concrete: money either
   * sits as cash or it's been converted into stock. Nothing here is a stored
   * number; both halves are derived every time, same as everything else of
   * consequence in this system.
   */
  async overview() {
    const acct = await this.account();
    const [{ moved }] = acct.openingAsOf
      ? await this.db.query(
          `SELECT COALESCE(SUM(amount), 0) AS moved FROM cash_transaction WHERE occurred_at::date >= $1`,
          [acct.openingAsOf],
        )
      : [{ moved: '0' }];
    const cash = acct.openingAsOf ? Number(acct.openingBalance) + Number(moved) : null;

    const [{ stockValue }] = await this.db.query(
      `SELECT COALESCE(SUM(stock.on_hand * COALESCE(v.unit_cost, 0)), 0) AS "stockValue"
       FROM product p
       JOIN product_variant v ON v.product_id = p.id
       JOIN LATERAL (
         SELECT COALESCE(SUM(quantity), 0)::int AS on_hand
         FROM stock_movement WHERE variant_id = v.id
       ) stock ON TRUE
       WHERE p.active`,
    );

    return {
      cash: cash === null ? null : cash.toFixed(2),
      stockValue: Number(stockValue).toFixed(2),
      totalAssets: cash === null ? null : (cash + Number(stockValue)).toFixed(2),
      openingBalance: acct.openingBalance,
      openingAsOf: acct.openingAsOf,
    };
  }

  async history(limit = 100) {
    return this.db.getRepository(CashTransaction).find({
      order: { occurredAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /** Sets the anchor cash was true at before the ledger started. */
  async setAnchor(openingBalance: string, openingAsOf: string) {
    if (!MONEY.test(openingBalance)) throw new BadRequestException('openingBalance must be an amount like 1000.00');
    const repo = this.db.getRepository(CashAccount);
    const current = (await repo.findOneBy({ id: 'default' })) ?? repo.create({ id: 'default' });
    current.openingBalance = openingBalance;
    current.openingAsOf = openingAsOf;
    return repo.save(current);
  }

  /** Owner adds or removes funds — the only manually-entered movement. */
  async recordCapital(
    amount: string,
    direction: 'IN' | 'OUT',
    note: string | undefined,
    userId: string,
  ) {
    if (!MONEY.test(amount)) throw new BadRequestException('amount must be like 1000.00');
    return this.db.getRepository(CashTransaction).save({
      amount: direction === 'IN' ? amount : `-${amount}`,
      reason: direction === 'IN' ? 'CAPITAL_INJECTION' : 'CAPITAL_WITHDRAWAL',
      note: note?.trim() || null,
      createdById: userId,
    });
  }

  /** A stock purchase converts cash into inventory — record the cash side. */
  recordPurchase(tx: EntityManager, amount: string, sourceId: string) {
    return tx.insert(CashTransaction, {
      amount: `-${amount}`,
      reason: 'PURCHASE' as CashReason,
      sourceType: 'stock_movement',
      sourceId,
    });
  }

  /** A real noon bank transfer landed — this is actual cash, not proceeds. */
  recordNoonPayout(tx: EntityManager, amount: string, sourceId: string) {
    return tx.insert(CashTransaction, {
      amount,
      reason: 'NOON_PAYOUT' as CashReason,
      sourceType: 'noon_transaction',
      sourceId,
    });
  }

  /** An order was marked paid — the money is now actually in hand. */
  recordOrderPayment(tx: EntityManager, orderId: string, amount: string) {
    return tx.insert(CashTransaction, {
      amount,
      reason: 'ORDER_PAYMENT' as CashReason,
      sourceType: 'order',
      sourceId: orderId,
    });
  }
}
