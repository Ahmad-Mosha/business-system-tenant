import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  LEDGER_ACCOUNTS,
  LedgerAccount,
  type LedgerAccountCode,
  type LedgerAccountKind,
} from './ledger-account.entity';
import { LedgerEntry, type LedgerEntryKind } from './ledger-entry.entity';

const MONEY = /^\d+(\.\d{1,2})?$/;

export interface PostEntry {
  amount: string | number;
  debit: LedgerAccountCode;
  credit: LedgerAccountCode;
  kind: LedgerEntryKind;
  occurredAt?: Date;
  memo?: string | null;
  supplierId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  actorId?: string | null;
}

export interface EntryFilter {
  code?: LedgerAccountCode;
  kind?: LedgerEntryKind;
  supplierId?: string;
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  limit?: number;
  offset?: number;
}

/**
 * For an ASSET or EXPENSE account, more debited than credited is a positive
 * balance; for LIABILITY / EQUITY / INCOME it is the other way round. This is
 * the only place that sign rule lives.
 */
export function naturalBalance(
  kind: LedgerAccountKind,
  debited: number,
  credited: number,
): number {
  return kind === 'ASSET' || kind === 'EXPENSE' ? debited - credited : credited - debited;
}

/**
 * Owns the double-entry ledger. Everything financial is posted here and every
 * balance is read from here — no other table holds a running money total.
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

  /**
   * Records one balanced movement. `amount` must be positive; direction is the
   * two account codes, never a sign. Pass `tx` to post inside a caller's
   * transaction so the ledger and whatever caused the entry commit together.
   */
  async post(input: PostEntry, tx: EntityManager = this.db.manager): Promise<LedgerEntry> {
    const amount = this.normaliseAmount(input.amount);
    if (input.debit === input.credit) {
      throw new BadRequestException('a ledger entry must move value between two different accounts');
    }

    return tx.save(
      tx.create(LedgerEntry, {
        amount,
        debitCode: input.debit,
        creditCode: input.credit,
        kind: input.kind,
        occurredAt: input.occurredAt ?? new Date(),
        memo: input.memo ?? null,
        supplierId: input.supplierId ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        actorId: input.actorId ?? null,
      }),
    );
  }

  /**
   * Undoes an entry by posting its mirror image — same amount, accounts
   * swapped, `reversesId` pointing back. The original stays exactly as it was.
   */
  async reverse(
    entryId: string,
    actorId?: string | null,
    tx: EntityManager = this.db.manager,
  ): Promise<LedgerEntry> {
    const original = await tx.findOneBy(LedgerEntry, { id: entryId });
    if (!original) throw new NotFoundException('ledger entry not found');
    if (original.reversesId) {
      throw new BadRequestException('that entry is itself a reversal');
    }

    return this.post(
      {
        amount: original.amount,
        debit: original.creditCode as LedgerAccountCode,
        credit: original.debitCode as LedgerAccountCode,
        kind: original.kind,
        occurredAt: new Date(),
        memo: `Reversal — ${original.memo ?? original.kind}`,
        supplierId: original.supplierId,
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        actorId: actorId ?? null,
      },
      tx,
    ).then(async (rev) => {
      await tx.update(LedgerEntry, { id: rev.id }, { reversesId: original.id });
      rev.reversesId = original.id;
      return rev;
    });
  }

  /**
   * The natural (positive-is-normal) balance of one account. `asOf` counts only
   * entries up to and including that date; `supplierId` narrows to one
   * supplier, for the per-supplier payable balance.
   */
  async balanceOf(
    code: LedgerAccountCode,
    opts: { asOf?: string; supplierId?: string } = {},
    tx: EntityManager = this.db.manager,
  ): Promise<string> {
    const where: string[] = [];
    const params: unknown[] = [code];
    if (opts.asOf) {
      params.push(opts.asOf);
      where.push(`e.occurred_at::date <= $${params.length}`);
    }
    if (opts.supplierId) {
      params.push(opts.supplierId);
      where.push(`e.supplier_id = $${params.length}`);
    }
    const extra = where.length ? `AND ${where.join(' AND ')}` : '';

    const [r] = await tx.query(
      `SELECT a.kind,
              COALESCE(SUM(e.amount) FILTER (WHERE e.debit_code = a.code), 0)  AS debited,
              COALESCE(SUM(e.amount) FILTER (WHERE e.credit_code = a.code), 0) AS credited
       FROM ledger_account a
       LEFT JOIN ledger_entry e
         ON (e.debit_code = a.code OR e.credit_code = a.code) ${extra}
       WHERE a.code = $1
       GROUP BY a.kind`,
      params,
    );
    if (!r) throw new NotFoundException(`no such account: ${code}`);
    return naturalBalance(r.kind, Number(r.debited), Number(r.credited)).toFixed(2);
  }

  /** Every account with its current balance, in display order — for the overview. */
  async balances(tx: EntityManager = this.db.manager): Promise<
    Array<{ code: string; nameAr: string; nameEn: string; kind: LedgerAccountKind; balance: string }>
  > {
    const rows: Array<{
      code: string;
      nameAr: string;
      nameEn: string;
      kind: LedgerAccountKind;
      debited: string;
      credited: string;
    }> = await tx.query(
      `SELECT a.code, a.name_ar AS "nameAr", a.name_en AS "nameEn", a.kind, a.sort,
              COALESCE(SUM(e.amount) FILTER (WHERE e.debit_code = a.code), 0)  AS debited,
              COALESCE(SUM(e.amount) FILTER (WHERE e.credit_code = a.code), 0) AS credited
       FROM ledger_account a
       LEFT JOIN ledger_entry e ON (e.debit_code = a.code OR e.credit_code = a.code)
       GROUP BY a.code, a.name_ar, a.name_en, a.kind, a.sort
       ORDER BY a.sort`,
    );
    return rows.map((r) => ({
      code: r.code,
      nameAr: r.nameAr,
      nameEn: r.nameEn,
      kind: r.kind,
      balance: naturalBalance(r.kind, Number(r.debited), Number(r.credited)).toFixed(2),
    }));
  }

  /**
   * Entries matching a filter, newest first, each with the account names and a
   * signed effect on the account being filtered (when `code` is given).
   */
  async entries(filter: EntryFilter, tx: EntityManager = this.db.manager) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);

    const where: string[] = [];
    const params: unknown[] = [];
    const bind = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (filter.code) where.push(`(e.debit_code = ${bind(filter.code)} OR e.credit_code = ${bind(filter.code)})`);
    if (filter.kind) where.push(`e.kind = ${bind(filter.kind)}`);
    if (filter.supplierId) where.push(`e.supplier_id = ${bind(filter.supplierId)}`);
    if (filter.from) where.push(`e.occurred_at::date >= ${bind(filter.from)}`);
    if (filter.to) where.push(`e.occurred_at::date <= ${bind(filter.to)}`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await tx.query(
      `SELECT e.id, e.occurred_at AS "occurredAt", e.amount, e.kind, e.memo,
              e.debit_code AS "debitCode", e.credit_code AS "creditCode",
              d.name_ar AS "debitAr", c.name_ar AS "creditAr",
              e.supplier_id AS "supplierId", e.source_type AS "sourceType",
              e.source_id AS "sourceId", e.reverses_id AS "reversesId",
              e.actor_id AS "actorId",
              count(*) OVER()::int AS "totalCount"
       FROM ledger_entry e
       JOIN ledger_account d ON d.code = e.debit_code
       JOIN ledger_account c ON c.code = e.credit_code
       ${whereSql}
       ORDER BY e.occurred_at DESC, e.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return { entries: rows, total: rows[0]?.totalCount ?? 0, limit, offset };
  }

  /**
   * One account's movements, newest first, each with its signed effect on that
   * account and the running balance after it. Capped rather than paged — the
   * full, filterable history is the Ledger screen's job.
   *
   * ponytail: last `limit` movements only; the running balance is exact for
   * those because the window runs over every entry for the account.
   */
  async accountLedger(code: LedgerAccountCode, limit = 100, tx: EntityManager = this.db.manager) {
    const capped = Math.min(Math.max(limit, 1), 500);
    return tx.query(
      `WITH moves AS (
         SELECT le.*,
                CASE WHEN a.kind IN ('ASSET', 'EXPENSE')
                     THEN CASE WHEN le.debit_code = a.code THEN le.amount ELSE -le.amount END
                     ELSE CASE WHEN le.credit_code = a.code THEN le.amount ELSE -le.amount END
                END AS effect
         FROM ledger_entry le
         JOIN ledger_account a ON a.code = $1
         WHERE le.debit_code = $1 OR le.credit_code = $1
       )
       SELECT m.id, m.occurred_at AS "occurredAt", m.amount, m.kind, m.memo,
              m.debit_code AS "debitCode", m.credit_code AS "creditCode",
              d.name_ar AS "debitAr", c.name_ar AS "creditAr",
              m.supplier_id AS "supplierId", m.source_type AS "sourceType",
              m.source_id AS "sourceId", m.reverses_id AS "reversesId", m.actor_id AS "actorId",
              m.effect,
              SUM(m.effect) OVER (ORDER BY m.occurred_at, m.created_at)::text AS "runningBalance"
       FROM moves m
       JOIN ledger_account d ON d.code = m.debit_code
       JOIN ledger_account c ON c.code = m.credit_code
       ORDER BY m.occurred_at DESC, m.created_at DESC
       LIMIT ${capped}`,
      [code],
    );
  }

  /**
   * Daily closing balance of one account across a window — for the overview
   * chart. Every day in the range gets a point, carried forward on quiet days.
   */
  async dailyBalance(
    code: LedgerAccountCode,
    fromDate: string,
    tx: EntityManager = this.db.manager,
  ): Promise<Array<{ date: string; balance: string }>> {
    return tx.query(
      `WITH signed AS (
         SELECT e.occurred_at::date AS d,
                CASE WHEN a.kind IN ('ASSET', 'EXPENSE')
                     THEN CASE WHEN e.debit_code = a.code THEN e.amount ELSE -e.amount END
                     ELSE CASE WHEN e.credit_code = a.code THEN e.amount ELSE -e.amount END
                END AS effect
         FROM ledger_entry e
         JOIN ledger_account a ON a.code = $1
         WHERE e.debit_code = $1 OR e.credit_code = $1
       ),
       opening AS (
         SELECT COALESCE(SUM(effect), 0) AS bal FROM signed WHERE d < $2::date
       ),
       per_day AS (
         SELECT d, SUM(effect) AS delta FROM signed WHERE d >= $2::date GROUP BY d
       )
       SELECT g::date::text AS date,
              ((SELECT bal FROM opening)
                + COALESCE(SUM(p.delta) OVER (ORDER BY g), 0))::text AS balance
       FROM generate_series($2::date, CURRENT_DATE, '1 day') g
       LEFT JOIN per_day p ON p.d = g
       ORDER BY g`,
      [code, fromDate],
    );
  }

  /**
   * Revenue and cost components for a period, from the profit accounts. The
   * gross/net split is a choice of which of these to subtract — open decision
   * #6 — so the raw components are returned and the interpretation stays thin.
   */
  async periodSummary(
    from: string,
    to: string,
    tx: EntityManager = this.db.manager,
  ): Promise<Record<string, string>> {
    const acct = (code: string) =>
      `COALESCE(SUM(amount) FILTER (WHERE credit_code = '${code}'), 0)
       - COALESCE(SUM(amount) FILTER (WHERE debit_code = '${code}'), 0)`;
    const expense = (code: string) =>
      `COALESCE(SUM(amount) FILTER (WHERE debit_code = '${code}'), 0)
       - COALESCE(SUM(amount) FILTER (WHERE credit_code = '${code}'), 0)`;

    const [r] = await tx.query(
      `SELECT ${acct('SALES')}          AS revenue,
              ${expense('COGS')}         AS cogs,
              ${expense('CHANNEL_FEES')} AS "channelFees",
              ${expense('SHIPPING')}     AS shipping,
              ${expense('OTHER_EXPENSE')} AS "otherExpense"
       FROM ledger_entry
       WHERE occurred_at::date BETWEEN $1 AND $2`,
      [from, to],
    );

    const n = (v: string) => Number(v);
    const grossProfit = n(r.revenue) - n(r.cogs) - n(r.channelFees);
    const netProfit = grossProfit - n(r.shipping) - n(r.otherExpense);
    return {
      revenue: n(r.revenue).toFixed(2),
      cogs: n(r.cogs).toFixed(2),
      channelFees: n(r.channelFees).toFixed(2),
      shipping: n(r.shipping).toFixed(2),
      otherExpense: n(r.otherExpense).toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      netProfit: netProfit.toFixed(2),
    };
  }

  private normaliseAmount(value: string | number): string {
    const str = typeof value === 'number' ? value.toFixed(2) : value.trim();
    if (!MONEY.test(str) || Number(str) <= 0) {
      throw new BadRequestException('amount must be a positive value like 1500.00');
    }
    return Number(str).toFixed(2);
  }
}
