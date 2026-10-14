import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { Expense, ExpenseCategory } from './expense.entity';
import { LedgerService } from './ledger.service';
import { problem } from '../problem';

export interface ExpenseInput {
  requestId: string;
  category: string;
  amount: string;
  spentOn: string;
  note?: string;
}

@Injectable()
export class ExpensesService {
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly ledger: LedgerService) {}

  categories() { return this.db.getRepository(ExpenseCategory).find({ order: { name: 'ASC' } }); }

  /** Live expenses by default; `cancelled` brings the voided ones back, with who voided them and why. */
  async list(filters: { category?: string; search?: string; from?: string; to?: string; page?: number; cancelled?: boolean }) {
    const page = Number.isSafeInteger(filters.page) && filters.page! > 0 ? filters.page! : 1;
    const params: string[] = [];
    const where: string[] = [];
    const bind = (v: string) => { params.push(v); return `$${params.length}`; };
    if (filters.category) where.push(`c.id::text = ${bind(filters.category)}`);
    if (filters.search) { const q = bind(`%${filters.search}%`); where.push(`(c.name ILIKE ${q} OR e.note ILIKE ${q})`); }
    for (const key of ['from', 'to'] as const) {
      if (filters[key]) {
        if (!validDate(filters[key]!)) throw new BadRequestException(problem('expense.date', 'enter a valid date'));
        where.push(`e.spent_on ${key === 'from' ? '>=' : '<='} ${bind(filters[key]!)}`);
      }
    }
    const from = 'FROM expense e JOIN expense_category c ON c.id = e.category_id LEFT JOIN app_user vu ON vu.id = e.voided_by_id';
    const filtered = `${from} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
    const scope = filters.cancelled ? filtered : `${filtered} ${where.length ? 'AND' : 'WHERE'} e.voided_at IS NULL`;
    const expenses = await this.db.query(`SELECT e.id, e.amount, e.spent_on::text AS "spentOn", e.note,
      e.voided_at AS "voidedAt", e.void_reason AS "voidReason", vu.name AS "voidedBy", c.name AS category,
      e.ledger_entry_id AS "ledgerEntryId", e.replaces_id AS "replacesId",
      (SELECT n.id FROM expense n WHERE n.replaces_id = e.id LIMIT 1) AS "replacedById"
      ${scope}
      ORDER BY e.spent_on DESC, e.created_at DESC, e.id
      LIMIT 50 OFFSET ${(page - 1) * 50}`, params);
    const [summary] = await this.db.query(`SELECT count(*)::int AS total,
      COALESCE(SUM(e.amount) FILTER (WHERE e.voided_at IS NULL), 0)::text AS "totalAmount" ${scope}`, params);
    const [{ cancelled }] = await this.db.query(`SELECT count(*) FILTER (WHERE e.voided_at IS NOT NULL)::int AS cancelled ${filtered}`, params);
    return { expenses, ...summary, cancelled, page };
  }

  /**
   * Records an expense. With `replaces`, it is the corrected version of one
   * already recorded: the original is voided (its cash comes back) and this one
   * booked, in one transaction — a resend with the same `requestId` returns the
   * same correction instead of voiding twice.
   */
  async create(input: ExpenseInput, actorId: string, replaces?: { id: string; reason: string }) {
    const name = typeof input.category === 'string' ? input.category.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 100) throw new BadRequestException(problem('expense.category', 'enter a category up to 100 characters'));
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(input.amount ?? '') || Number(input.amount) <= 0) throw new BadRequestException(problem('expense.amount', 'enter a positive amount'));
    if (!validDate(input.spentOn)) throw new BadRequestException(problem('expense.date', 'enter a valid date'));
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId ?? '')) throw new BadRequestException('requestId must be a UUID');
    if (input.note && (typeof input.note !== 'string' || input.note.length > 2000)) throw new BadRequestException(problem('expense.note', 'the note is too long'));
    if (replaces && (!replaces.reason?.trim() || replaces.reason.length > 1000)) {
      throw new BadRequestException(problem('expense.reason', 'enter a correction reason'));
    }
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`expense:${input.requestId}`]);
      const previous = await tx.findOne(Expense, { where: { requestId: input.requestId }, relations: { category: true } });
      if (previous) {
        if (Number(previous.amount) !== Number(input.amount) || previous.category.key !== name.toLowerCase() ||
            String(previous.spentOn).slice(0, 10) !== input.spentOn || previous.createdById !== actorId || (previous.note ?? '') !== (input.note?.trim() ?? '')) {
          throw new BadRequestException(problem('expense.retryChanged', 'this submission was already used for another expense'));
        }
        return previous;
      }
      if (replaces) await this.voidIn(tx, replaces.id, replaces.reason, actorId, true);
      await tx.query('INSERT INTO expense_category (name, key) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [name, name.toLowerCase()]);
      const category = await tx.findOneByOrFail(ExpenseCategory, { key: name.toLowerCase() });
      const id = randomUUID();
      const entry = await this.ledger.post({ amount: input.amount, debit: 'OTHER_EXPENSE', credit: 'CASH', kind: 'PAYMENT_OUT',
        occurredAt: new Date(`${input.spentOn}T00:00:00Z`), sourceType: 'expense', sourceId: id, actorId,
        memo: `${category.name}${input.note?.trim() ? ' — ' + input.note.trim() : ''}` }, tx);
      return tx.save(Expense, { id, requestId: input.requestId, categoryId: category.id, amount: entry.amount,
        spentOn: input.spentOn, note: input.note?.trim() || null, ledgerEntryId: entry.id, createdById: actorId,
        replacesId: replaces?.id ?? null });
    });
  }

  async void(id: string, reason: string, actorId: string) {
    if (!reason?.trim() || reason.length > 1000) throw new BadRequestException(problem('expense.reason', 'enter a correction reason'));
    return this.db.transaction((tx) => this.voidIn(tx, id, reason, actorId, false));
  }

  /**
   * Voids under a row lock: the cash entry is reversed with the reason, and who
   * did it is kept. A second void is a no-op; correcting one already voided is
   * refused — it would book the replacement on top of nothing.
   */
  private async voidIn(tx: EntityManager, id: string, reason: string, actorId: string, correcting: boolean) {
    const expense = await tx.findOne(Expense, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!expense) throw new NotFoundException(problem('notFound', 'expense not found'));
    if (expense.voidedAt) {
      if (correcting) throw new BadRequestException(problem('expense.alreadyVoided', 'this expense is already cancelled'));
      return expense;
    }
    await this.ledger.reverse(expense.ledgerEntryId, actorId, tx, reason);
    expense.voidedAt = new Date();
    expense.voidReason = reason.trim();
    expense.voidedById = actorId;
    return tx.save(expense);
  }
}

function validDate(value: string): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
