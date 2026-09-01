import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CashAccount } from './cash-account.entity';
import { LedgerService } from './ledger.service';

const MONEY = /^\d+(\.\d{1,2})?$/;

/**
 * The money read models the current finance screen needs, now backed entirely
 * by the double-entry ledger. `recordX` helpers are what the rest of the system
 * calls when an event has a cash consequence — each posts one balanced entry.
 */
@Injectable()
export class FinanceService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly ledger: LedgerService,
  ) {}

  private async account(): Promise<CashAccount> {
    const repo = this.db.getRepository(CashAccount);
    return (
      (await repo.findOneBy({ id: 'default' })) ??
      repo.create({ id: 'default', openingBalance: '0', openingAsOf: null })
    );
  }

  /**
   * Cash on hand and what it's built from. Cash is the anchor figure plus every
   * ledger movement of the CASH account since; stock value is still derived
   * from the stock ledger at current unit cost (valuation layers replace that
   * in a later step).
   */
  async overview() {
    const acct = await this.account();
    const moved = await this.ledger.balanceOf('CASH');
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

  /** Cash movements, newest first, shaped for the current history list. */
  async history(limit = 100) {
    const { entries } = await this.ledger.entries({ code: 'CASH', limit });
    return entries.map(
      (e: {
        id: string;
        amount: string;
        kind: string;
        memo: string | null;
        debitCode: string;
        sourceType: string | null;
        sourceId: string | null;
        occurredAt: string;
      }) => ({
        id: e.id,
        // CASH debited = cash in; CASH credited = cash out.
        amount: e.debitCode === 'CASH' ? e.amount : `-${e.amount}`,
        reason: e.kind,
        note: e.memo,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        occurredAt: e.occurredAt,
      }),
    );
  }

  /** Sets the anchor cash was true at before the ledger started. */
  async setAnchor(openingBalance: string, openingAsOf: string) {
    if (!MONEY.test(openingBalance)) {
      throw new BadRequestException('openingBalance must be an amount like 1000.00');
    }
    const repo = this.db.getRepository(CashAccount);
    const current = (await repo.findOneBy({ id: 'default' })) ?? repo.create({ id: 'default' });
    current.openingBalance = openingBalance;
    current.openingAsOf = openingAsOf;
    return repo.save(current);
  }

  /** Owner adds or removes funds — a hand-entered movement between cash and capital. */
  async recordCapital(
    amount: string,
    direction: 'IN' | 'OUT',
    note: string | undefined,
    userId: string,
  ) {
    if (!MONEY.test(amount)) throw new BadRequestException('amount must be like 1000.00');
    return this.ledger.post({
      amount,
      debit: direction === 'IN' ? 'CASH' : 'OWNER_CAPITAL',
      credit: direction === 'IN' ? 'OWNER_CAPITAL' : 'CASH',
      kind: direction === 'IN' ? 'CASH_DEPOSIT' : 'CAPITAL_WITHDRAWAL',
      memo: note?.trim() || null,
      sourceType: 'manual',
      actorId: userId,
    });
  }

  /** A stock purchase converts cash into inventory. */
  recordPurchase(tx: EntityManager, amount: string, sourceId: string) {
    return this.ledger.post(
      {
        amount,
        debit: 'INVENTORY',
        credit: 'CASH',
        kind: 'PURCHASE',
        sourceType: 'stock_movement',
        sourceId,
      },
      tx,
    );
  }

  /** A real noon bank transfer landed — receivable becomes actual cash. */
  recordNoonPayout(tx: EntityManager, amount: string, sourceId: string) {
    return this.ledger.post(
      {
        amount,
        debit: 'CASH',
        credit: 'NOON_RECEIVABLE',
        kind: 'NOON_PAYOUT',
        sourceType: 'noon_transaction',
        sourceId,
      },
      tx,
    );
  }

  /** An order was marked paid — money is now in hand, booked against revenue. */
  recordOrderPayment(tx: EntityManager, orderId: string, amount: string) {
    return this.ledger.post(
      {
        amount,
        debit: 'CASH',
        credit: 'SALES',
        kind: 'ORDER_SALE',
        sourceType: 'order',
        sourceId: orderId,
      },
      tx,
    );
  }
}
