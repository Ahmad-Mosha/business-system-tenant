import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { LedgerService } from './ledger.service';

const MONEY = /^\d+(\.\d{1,2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The one live opening-balance entry: not itself a reversal, not reversed. */
const LIVE_OPENING = `
  SELECT id, amount, occurred_at::date::text AS "asOf"
  FROM ledger_entry e
  WHERE e.source_type = 'opening' AND e.source_id = 'cash'
    AND e.reverses_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_id = e.id)`;

/**
 * The money read models the current finance screen needs, backed entirely by
 * the double-entry ledger. `recordX` helpers are what the rest of the system
 * calls when an event has a cash consequence — each posts one balanced entry.
 */
@Injectable()
export class FinanceService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Cash on hand and what it's built from. Cash is the CASH account's ledger
   * balance (the opening entry included); stock value is still derived from the
   * stock ledger at current unit cost — valuation layers replace that later.
   */
  async overview() {
    const [opening] = await this.db.query(LIVE_OPENING);
    const cash = opening ? await this.ledger.balanceOf('CASH') : null;

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
      cash: cash === null ? null : cash,
      stockValue: Number(stockValue).toFixed(2),
      totalAssets: cash === null ? null : (Number(cash) + Number(stockValue)).toFixed(2),
      openingBalance: opening?.amount ?? '0',
      openingAsOf: opening?.asOf ?? null,
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

  /**
   * Sets what cash was before the ledger started tracking it — recorded as an
   * `OPENING_BALANCE` entry (CASH ← opening equity). Re-running it reverses the
   * previous opening entry and posts a fresh one, so the anchor stays a single
   * traceable line rather than a mutable field.
   */
  async setAnchor(openingBalance: string, openingAsOf: string) {
    if (!MONEY.test(openingBalance)) {
      throw new BadRequestException('openingBalance must be an amount like 1000.00');
    }
    if (!ISO_DATE.test(openingAsOf)) {
      throw new BadRequestException('openingAsOf must be YYYY-MM-DD');
    }

    return this.db.transaction(async (tx) => {
      const [prior] = await tx.query(LIVE_OPENING);
      if (prior) await this.ledger.reverse(prior.id, null, tx);

      return this.ledger.post(
        {
          amount: openingBalance,
          debit: 'CASH',
          credit: 'OPENING_EQUITY',
          kind: 'OPENING_BALANCE',
          occurredAt: new Date(`${openingAsOf}T00:00:00Z`),
          memo: 'Opening cash balance',
          sourceType: 'opening',
          sourceId: 'cash',
        },
        tx,
      );
    });
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
