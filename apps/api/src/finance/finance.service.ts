import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Cheque, type ChequeStatus } from './cheque.entity';
import type { LedgerAccountCode } from './ledger-account.entity';
import { LedgerService } from './ledger.service';

const MONEY = /^\d+(\.\d{1,2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * The accounts a hand-entered voucher may move cash against. Anything else is
 * the consequence of a real event (a sale, a payout) and is not typed in.
 */
export const VOUCHER_ACCOUNTS: readonly LedgerAccountCode[] = [
  'SHIPPING',
  'CHANNEL_FEES',
  'OTHER_EXPENSE',
  'OWNER_CAPITAL',
];

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

  /**
   * A hand-entered cash voucher: سند قبض (money in) or سند صرف (money out),
   * moving cash against one permitted counter-account. إيداع نقدي is just this
   * with the counter set to owner capital.
   */
  async recordVoucher(input: {
    direction: 'IN' | 'OUT';
    counter: LedgerAccountCode;
    amount: string;
    memo?: string;
    occurredAt?: string;
    userId: string;
  }) {
    if (!MONEY.test(input.amount)) throw new BadRequestException('amount must be like 1000.00');
    if (!VOUCHER_ACCOUNTS.includes(input.counter)) {
      throw new BadRequestException(`counter must be one of: ${VOUCHER_ACCOUNTS.join(', ')}`);
    }
    if (input.occurredAt && !ISO_DATE.test(input.occurredAt)) {
      throw new BadRequestException('occurredAt must be YYYY-MM-DD');
    }

    const capital = input.counter === 'OWNER_CAPITAL';
    return this.ledger.post({
      amount: input.amount,
      debit: input.direction === 'IN' ? 'CASH' : input.counter,
      credit: input.direction === 'IN' ? input.counter : 'CASH',
      kind: capital
        ? input.direction === 'IN'
          ? 'CASH_DEPOSIT'
          : 'CAPITAL_WITHDRAWAL'
        : input.direction === 'IN'
          ? 'PAYMENT_IN'
          : 'PAYMENT_OUT',
      memo: input.memo?.trim() || null,
      occurredAt: input.occurredAt ? new Date(`${input.occurredAt}T00:00:00Z`) : undefined,
      sourceType: 'voucher',
      actorId: input.userId,
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

  // ── Cheques (إيداع سندي) ────────────────────────────────────────────────

  listCheques(status?: ChequeStatus) {
    return this.db.getRepository(Cheque).find({
      where: status ? { status } : {},
      order: { receivedDate: 'DESC', createdAt: 'DESC' },
    });
  }

  /** Records a received cheque and books it into `CHEQUES_PENDING` — not cash. */
  async createCheque(
    input: {
      amount: string;
      fromParty: string;
      receivedDate: string;
      dueDate?: string;
      memo?: string;
    },
    userId: string,
  ) {
    if (!MONEY.test(input.amount)) throw new BadRequestException('amount must be like 1000.00');
    if (!input.fromParty?.trim()) throw new BadRequestException('who the cheque is from is required');
    for (const [name, v] of [['receivedDate', input.receivedDate], ['dueDate', input.dueDate]] as const) {
      if (v && !ISO_DATE.test(v)) throw new BadRequestException(`${name} must be YYYY-MM-DD`);
    }
    if (!input.receivedDate) throw new BadRequestException('receivedDate is required');

    return this.db.transaction(async (tx) => {
      const cheque = await tx.save(Cheque, {
        amount: Number(input.amount).toFixed(2),
        fromParty: input.fromParty.trim(),
        receivedDate: input.receivedDate,
        dueDate: input.dueDate || null,
        memo: input.memo?.trim() || null,
        status: 'PENDING',
        createdById: userId,
      });
      const entry = await this.ledger.post(
        {
          amount: cheque.amount,
          debit: 'CHEQUES_PENDING',
          credit: 'OWNER_CAPITAL',
          kind: 'CHEQUE_DEPOSIT',
          occurredAt: new Date(`${input.receivedDate}T00:00:00Z`),
          memo: `Cheque from ${cheque.fromParty}`,
          sourceType: 'cheque',
          sourceId: cheque.id,
          actorId: userId,
        },
        tx,
      );
      await tx.update(Cheque, { id: cheque.id }, { depositEntryId: entry.id });
      return { ...cheque, depositEntryId: entry.id };
    });
  }

  /** Clears a pending cheque into cash, or reverses it if it bounced. */
  async settleCheque(
    id: string,
    next: 'CLEARED' | 'BOUNCED',
    clearedDate: string | undefined,
    userId: string,
  ) {
    if (clearedDate && !ISO_DATE.test(clearedDate)) {
      throw new BadRequestException('clearedDate must be YYYY-MM-DD');
    }
    return this.db.transaction(async (tx) => {
      const cheque = await tx.findOneBy(Cheque, { id });
      if (!cheque) throw new BadRequestException('cheque not found');
      if (cheque.status !== 'PENDING') {
        throw new BadRequestException(`this cheque is already ${cheque.status.toLowerCase()}`);
      }

      if (next === 'CLEARED') {
        const on = clearedDate ?? today();
        await this.ledger.post(
          {
            amount: cheque.amount,
            debit: 'CASH',
            credit: 'CHEQUES_PENDING',
            kind: 'CHEQUE_CLEAR',
            occurredAt: new Date(`${on}T00:00:00Z`),
            memo: `Cheque from ${cheque.fromParty} cleared`,
            sourceType: 'cheque',
            sourceId: cheque.id,
            actorId: userId,
          },
          tx,
        );
        cheque.status = 'CLEARED';
        cheque.clearedDate = on;
      } else {
        if (cheque.depositEntryId) await this.ledger.reverse(cheque.depositEntryId, userId, tx);
        cheque.status = 'BOUNCED';
      }
      return tx.save(cheque);
    });
  }

  // ── Automatic entries called from other modules ─────────────────────────

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
